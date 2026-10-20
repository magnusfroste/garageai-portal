import { supabase } from "@/integrations/supabase/client";

// Chat requests go straight from the browser to the EU gateway. Prompts never
// pass through GarageAI servers. The only server calls are: fetching the
// creation of this browser's chat key (stored only in the browser), and
// web-search queries (query only). Key values are never read from the portal.
export const GATEWAY_CHAT_URL = "https://llm.garageai.eu/v1/chat/completions";

const MAX_SEARCH_ROUNDS = 3;

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information. Returns numbered sources.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};

const SEARCH_SYSTEM =
  "You have access to the web_search tool. Use it when the question needs current or factual information. " +
  "Sources are numbered. Cite them as [1], [2], and so on, using the same numbers as the search results. Answer in the user's language.";

/** Gateway HTTP failure; status 401 means the chat key no longer works. */
export class GatewayHttpError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "GatewayHttpError"; }
}

// ---- Web search: only the query string leaves the browser ----
interface SearchHit { title: string; url: string; content: string }

export async function runWebSearch(query: string): Promise<SearchHit[]> {
  const { data, error } = await supabase.functions.invoke("web-search", { body: { query } });
  if (error) throw new Error("search_failed");
  return (data?.results as SearchHit[] | undefined) ?? [];
}

// ---- Streaming ----
export interface GatewayStreamEvents {
  onContent: (text: string) => void;
  onReasoning: (text: string) => void;
  onUsage: (usage: { prompt_tokens?: number; completion_tokens?: number }) => void;
  onGarage: (garage: string | null) => void;
  /** Catalogue name of the model that actually served the answer (gateway PR #197). */
  onServedModel?: (model: string) => void;
  onSearchStatus: (status: { type: "search" | "found"; query: string; count?: number }) => void;
  onSources: (sources: Array<{ n: number; title: string; url: string }>, queries: string[]) => void;
}

interface ToolCallAcc { id: string; name: string; args: string }

function garageFromResponse(res: Response): string | null {
  const id = res.headers.get("x-litellm-model-id") || "";
  const parts = id.split("__");
  return parts.length >= 2 && parts[0] ? parts[0] : null;
}

async function streamOneRound(
  body: Record<string, unknown>,
  keyValue: string,
  signal: AbortSignal,
  ev: GatewayStreamEvents,
  forwardContent: boolean,
): Promise<{ content: string; calls: ToolCallAcc[] }> {
  const res = await fetch(GATEWAY_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyValue}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "" }));
    throw new GatewayHttpError(res.status, String(err?.error?.message || err?.error || `HTTP ${res.status}`));
  }
  ev.onGarage(garageFromResponse(res));

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let content = "";
  const calls: ToolCallAcc[] = [];

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break outer;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.usage) ev.onUsage(evt.usage);
      if (typeof evt.model === "string" && evt.model) ev.onServedModel?.(evt.model);
      const delta = evt.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const i = typeof tc.index === "number" ? tc.index : calls.length;
          calls[i] ??= { id: "", name: "", args: "" };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name) calls[i].name += tc.function.name;
          if (tc.function?.arguments) calls[i].args += tc.function.arguments;
        }
        continue;
      }
      const c = (delta.content as string | undefined) ?? "";
      const r = (delta.reasoning_content as string | undefined) ?? (delta.reasoning as string | undefined) ?? "";
      if (c) {
        content += c;
        if (forwardContent) ev.onContent(c);
      }
      if (r) ev.onReasoning(r);
    }
  }
  return { content, calls: calls.filter(Boolean) };
}

export interface StreamChatOptions {
  keyValue: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  webSearch?: boolean;
  signal: AbortSignal;
}

/** Streams a chat answer from the gateway; runs the web-search tool loop in the browser when enabled. */
export async function streamChat(opts: StreamChatOptions, ev: GatewayStreamEvents): Promise<void> {
  const baseMessages: unknown[] = opts.systemPrompt
    ? [{ role: "system", content: opts.systemPrompt }, ...opts.messages]
    : [...opts.messages];

  if (!opts.webSearch) {
    await streamOneRound(
      { model: opts.model, messages: baseMessages, stream: true, stream_options: { include_usage: true } },
      opts.keyValue, opts.signal, ev, true,
    );
    return;
  }

  const convo: unknown[] = [{ role: "system", content: SEARCH_SYSTEM }, ...baseMessages];
  const sources: Array<{ n: number; title: string; url: string }> = [];
  const queries: string[] = [];

  for (let round = 0; round <= MAX_SEARCH_ROUNDS; round++) {
    const allowTools = round < MAX_SEARCH_ROUNDS;
    const { content, calls } = await streamOneRound(
      {
        model: opts.model, messages: convo, stream: true,
        stream_options: { include_usage: true },
        ...(allowTools ? { tools: [WEB_SEARCH_TOOL], tool_choice: "auto" } : {}),
      },
      opts.keyValue, opts.signal, ev, true,
    );

    const valid = calls.filter((c) => c.name === "web_search");
    if (!valid.length) break;

    convo.push({
      role: "assistant", content: content || null,
      tool_calls: valid.map((c, i) => ({ id: c.id || `call_${round}_${i}`, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
    });
    for (const [i, c] of valid.entries()) {
      const id = c.id || `call_${round}_${i}`;
      let query = "";
      try { query = String(JSON.parse(c.args || "{}").query || "").trim(); } catch { /* ignore */ }
      if (!query) {
        convo.push({ role: "tool", tool_call_id: id, content: "Error: invalid tool call." });
        continue;
      }
      queries.push(query);
      ev.onSearchStatus({ type: "search", query });
      let text: string;
      try {
        const hits = await runWebSearch(query);
        const numbered = hits.map((h) => {
          const src = { n: sources.length + 1, title: h.title, url: h.url };
          sources.push(src);
          return { ...src, content: h.content };
        });
        ev.onSearchStatus({ type: "found", query, count: hits.length });
        text = numbered.length
          ? numbered.map((h) => `[${h.n}] ${h.title}\n${h.url}\n${h.content}`).join("\n\n")
          : "No results.";
      } catch {
        ev.onSearchStatus({ type: "found", query, count: 0 });
        text = "Search failed.";
      }
      convo.push({ role: "tool", tool_call_id: id, content: text });
    }
  }
  ev.onSources(sources, queries);
}
