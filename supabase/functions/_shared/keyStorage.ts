// Pure rules for what the portal stores about a key (no imports, testable).
/** Placeholder kept in the legacy NOT NULL UNIQUE column; never the real key. */
export const HIDDEN_PREFIX = "hidden:";

export function storedKeyValue(key: string, showOnce: boolean, id = crypto.randomUUID()): string {
  return showOnce ? `${HIDDEN_PREFIX}${id}` : key;
}

export const keyLast4 = (key: string) => key.slice(-4);

/** "Chat · Chrome on Mac" — device label is sanitised and capped. */
export function chatKeyName(deviceLabel: unknown): string {
  const label = typeof deviceLabel === "string" ? deviceLabel.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40) : "";
  return `Chat · ${label || "this browser"}`;
}

