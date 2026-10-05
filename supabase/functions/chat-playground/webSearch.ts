// Server-side web search tool loop for the chat playground.
// PRIVACY: never log search queries, results or prompts.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_SEARXNG = "https://search.liteit.se";
const MAX_ROUNDS = 3;
const SEARCH_TIMEOUT_MS = 8_000;

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information. Returns numbered sources.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};

const SEARCH_SYSTEM =
  "Du har tillgång till verktyget web_search. Använd det när frågan kräver aktuell eller faktabaserad information. " +
  "Källorna är numrerade. Citera källor i svaret som [1], [2] osv. med samma nummer som i sökresultaten.";

/** Pool model "x" supports tools if any garage serving x passed the probe; "garage/<g>/<m>" checks that garage. */
export async function modelSupportsTools(admin: SupabaseClient, model: string): Promise<boolean> {
  const { data } = await admin.rpc("garage_tool_support");
  const rows = (data || []) as Array<{ garage_name: string; model: string; supports_tools: boolean }>;
  const m = model.match(/^garage\/([^/]+)\/(.+)$/);
  if (m) return rows.some((r) => r.garage_name === m[1] && r.model === m[2] && r.supports_tools);
  return rows.some((r) => r.model === model && r.supports_tools);
}

export async function getSearxngUrl(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("admin_settings").select("value").eq("key", "site_settings").maybeSingle();
  const v = ((data?.value as Record<string, unknown> | null)?.searxng_url as string | undefined)?.trim();
  return (v || DEFAULT_SEARXNG).replace(/\/+$/, "");
}

interface Source { n: number; title: string; url: string; content: string }

async function searxSearch(base: string, query: string): Promise<Array<Omit<Source, "n">>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const hn = Deno.env.get("SEARXNG_HEADER_NAME");
  const hv = Deno.env.get("SEARXNG_HEADER_VALUE");
  if (hn && hv) headers[hn] = hv;
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=sv-SE`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  return ((json?.results || []) as Array<Record<string, unknown>>).slice(0, 5).map((r) => ({
    title: String(r.title || r.url || ""),
    url: String(r.url || ""),
    content: String(r.content || "").slice(0, 300),
  }));
}

interface ToolCallAcc { id: string; name: string; args: string }

export function streamWithWebSearch(opts: {
  proxyBase: string; apiKey: string; model: string; messages: unknown[]; searxngUrl: string; signal?: AbortSignal;
}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const status = (payload: Record<string, unknown>) => send({ garageai: payload });
      const convo: unknown[] = [{ role: "system", content: SEARCH_SYSTEM }, ...opts.messages];
      const sources: Source[] = [];
      const queries: string[] = [];

      try {
        for (let round = 0; round <= MAX_ROUNDS; round++) {
          const allowTools = round < MAX_ROUNDS;
          const res = await fetch(`${opts.proxyBase}/chat/completions`, {
            method: "POST",
            signal: opts.signal,
            headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: opts.model, messages: convo, stream: true,
              stream_options: { include_usage: true },
              ...(allowTools ? { tools: [WEB_SEARCH_TOOL], tool_choice: "auto" } : {}),
            }),
          });
          if (!res.ok || !res.body) {
            await res.body?.cancel().catch(() => {});
            status({ type: "error", message: `Modellförfrågan misslyckades (HTTP ${res.status})` });
            break;
          }

          const calls: ToolCallAcc[] = [];
          let content = "";
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") break outer;
              let evt: any;
              try { evt = JSON.parse(payload); } catch { continue; }
              const delta = evt?.choices?.[0]?.delta;
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const i = typeof tc.index === "number" ? tc.index : calls.length;
                  calls[i] ??= { id: "", name: "", args: "" };
                  if (tc.id) calls[i].id = tc.id;
                  if (tc.function?.name) calls[i].name += tc.function.name;
                  if (tc.function?.arguments) calls[i].args += tc.function.arguments;
                }
                continue;
              }
              if (typeof delta?.content === "string") content += delta.content;
              // Forward content/reasoning/usage chunks unchanged.
              send(evt);
            }
          }

          const valid = calls.filter(Boolean);
          if (!valid.length) break;

          convo.push({
            role: "assistant", content: content || null,
            tool_calls: valid.map((c, i) => ({ id: c.id || `call_${round}_${i}`, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
          });
          for (const [i, c] of valid.entries()) {
            const id = c.id || `call_${round}_${i}`;
            let query = "";
            try { query = String(JSON.parse(c.args || "{}").query || "").trim(); } catch { /* ignore */ }
            if (c.name !== "web_search" || !query) {
              convo.push({ role: "tool", tool_call_id: id, content: "Fel: ogiltigt verktygsanrop." });
              continue;
            }
            queries.push(query);
            status({ type: "search", query });
            let text: string;
            try {
              const hits = await searxSearch(opts.searxngUrl, query);
              const numbered: Source[] = [];
              for (const h of hits) { const src = { n: sources.length + 1, ...h }; sources.push(src); numbered.push(src); }
              status({ type: "found", query, count: hits.length });
              text = numbered.length
                ? numbered.map((h) => `[${h.n}] ${h.title}\n${h.url}\n${h.content}`).join("\n\n")
                : "Inga resultat.";
            } catch {
              status({ type: "found", query, count: 0 });
              text = "Sökningen misslyckades.";
            }
            convo.push({ role: "tool", tool_call_id: id, content: text });
          }
        }
        status({ type: "sources", queries, sources: sources.map(({ n, title, url }) => ({ n, title, url })) });
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (e) {
        if (!opts.signal?.aborted) status({ type: "error", message: "Ett fel uppstod under webbsökningen" });
        console.error("[chat-playground] web search loop failed:", e instanceof Error ? e.name : "unknown");
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
  });
}
