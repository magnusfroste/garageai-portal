// Pure name validation. Only server-authorized endpoint-provider actions may
// allow original vendor names; ordinary garage registration stays restricted.
const RESERVED_PREFIXES = ["gpt-", "chatgpt-", "o1", "o3", "o4-", "claude-", "gemini-", "grok-"];
export const MODEL_ID_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

export function modelIdError(model: string, allowVendorNames = false): string | null {
  if (!MODEL_ID_RE.test(model)) return `model id "${model}" must match ^[A-Za-z0-9._:/-]{1,128}$`;
  const lower = model.toLowerCase();
  if (lower.startsWith("mine/")) return `model id "${model}" may not start with "mine/" (reserved for owner routes)`;
  if (lower.startsWith("garage/")) return `model id "${model}" may not start with "garage/" (reserved for garage-specific routes)`;
  if (lower.startsWith("probe/")) return `model id "${model}" may not start with "probe/" (reserved)`;
  if (lower.startsWith("garageai/")) return `model id "${model}" may not start with "garageai/" (reserved)`;
  if (allowVendorNames) return null;
  const tail = lower.split("/").pop() || lower;
  const isGptOss = lower.startsWith("gpt-oss") || tail.startsWith("gpt-oss");
  for (const p of RESERVED_PREFIXES) {
    if (isGptOss && p === "gpt-") continue;
    if (lower.startsWith(p) || tail.startsWith(p)) return `model id "${model}" uses a reserved proprietary model name (${p}…)`;
  }
  return null;
}