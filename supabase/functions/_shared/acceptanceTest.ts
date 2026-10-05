// Acceptance test: a garage model must answer end to end through the gateway
// (LiteLLM -> mesh -> operator GPU) before buyers can use it.
//
// EARNINGS: every acceptance request is tagged "acceptance-test" in LiteLLM
// metadata (metadata.tags). These requests MUST be excluded when computing
// operator earnings — they are platform traffic, not buyer usage.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AcceptanceResult {
  model: string;
  passed: boolean;
  http_status: number | null;
  error: string | null;
  ttft_ms: number | null;
  duration_ms: number | null;
  output_tokens: number | null;
  tokens_per_second: number | null;
  instruction_followed: boolean;
}

const TIMEOUT_MS = 90_000;
const EXPECTED = "GARAGEAI-OK";

export async function runAcceptanceTest(
  litellmBase: string,
  masterKey: string,
  garageName: string,
  model: string,
): Promise<AcceptanceResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const result: AcceptanceResult = {
    model, passed: false, http_status: null, error: null, ttft_ms: null,
    duration_ms: null, output_tokens: null, tokens_per_second: null, instruction_followed: false,
  };

  let content = "";
  let reasoning = "";
  let chunks = 0;
  let usageTokens: number | null = null;

  try {
    const res = await fetch(`${litellmBase}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `garage/${garageName}/${model}`,
        stream: true,
        max_tokens: 512,
        temperature: 0,
        messages: [{ role: "user", content: `Reply with exactly this text and nothing else: ${EXPECTED}` }],
        metadata: { tags: ["acceptance-test"], garage: garageName },
      }),
    });
    result.http_status = res.status;

    if (res.status !== 200 || !res.body) {
      const text = await res.text().catch(() => "");
      result.error = (text || `HTTP ${res.status}`).slice(0, 300);
      return result;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") break outer;
        let evt: any;
        try { evt = JSON.parse(payload); } catch { continue; }
        if (evt?.usage?.completion_tokens != null) usageTokens = Number(evt.usage.completion_tokens);
        const delta = evt?.choices?.[0]?.delta || {};
        const c = typeof delta.content === "string" ? delta.content : "";
        const r = typeof delta.reasoning_content === "string" ? delta.reasoning_content
          : typeof delta.reasoning === "string" ? delta.reasoning : "";
        if (c || r) {
          if (result.ttft_ms === null) result.ttft_ms = Date.now() - start;
          chunks++;
          content += c;
          reasoning += r;
        }
      }
    }

    if (!content && !reasoning) {
      result.error = "empty response";
      return result;
    }
    result.passed = true;
  } catch (e) {
    result.error = controller.signal.aborted
      ? "timeout after 90s"
      : (e instanceof Error ? e.message : "request failed").slice(0, 300);
  } finally {
    clearTimeout(timer);
    result.duration_ms = Date.now() - start;
    result.instruction_followed = content.includes(EXPECTED);
    if (content || reasoning) result.output_tokens = usageTokens ?? chunks;
    if (result.output_tokens && result.ttft_ms !== null && result.duration_ms > result.ttft_ms) {
      result.tokens_per_second =
        Math.round((result.output_tokens / ((result.duration_ms - result.ttft_ms) / 1000)) * 10) / 10;
    }
  }
  return result;
}

/** Runs all tests in parallel and stores one garage_model_tests row per model. */
export async function runAndStoreAcceptanceTests(
  admin: SupabaseClient,
  litellmBase: string,
  masterKey: string,
  garage: { id: string; name: string },
  models: string[],
): Promise<AcceptanceResult[]> {
  const results = await Promise.all(models.map((m) => runAcceptanceTest(litellmBase, masterKey, garage.name, m)));
  const { error } = await admin.from("garage_model_tests").insert(
    results.map((r) => ({ garage_id: garage.id, ...r })),
  );
  if (error) console.error("[acceptance] failed to store results:", error.message);
  for (const r of results) {
    console.log("[acceptance]", { garage: garage.name, model: r.model, passed: r.passed, status: r.http_status, ttft_ms: r.ttft_ms });
  }
  return results;
}

export const toPublicResult = (r: AcceptanceResult) => ({
  model: r.model, passed: r.passed, error: r.error, ttft_ms: r.ttft_ms,
  tokens_per_second: r.tokens_per_second, instruction_followed: r.instruction_followed,
});
