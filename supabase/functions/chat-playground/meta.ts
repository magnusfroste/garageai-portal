// Derives which garage served a request from LiteLLM's deployment-id header
// (deployment ids are "<garage>__<model>__<tier>"). Never exposes keys or IPs.
export function garageMetaFromResponse(res: Response): { type: "meta"; garage: string | null; deployment_model: string | null } {
  const id = res.headers.get("x-litellm-model-id") || "";
  const parts = id.split("__");
  const garage = parts.length >= 2 && parts[0] ? parts[0] : null;
  const deploymentModel = res.headers.get("x-litellm-model-group") || null;
  return { type: "meta", garage, deployment_model: deploymentModel };
}

const enc = new TextEncoder();
export function encodeEvent(obj: unknown): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Prepends a garageai meta event to an upstream SSE body. */
export function withMeta(res: Response): ReadableStream<Uint8Array> {
  const meta = encodeEvent({ garageai: garageMetaFromResponse(res) });
  const upstream = res.body!;
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(meta);
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch { /* client aborted */ }
      controller.close();
    },
    cancel() { upstream.cancel().catch(() => {}); },
  });
}
