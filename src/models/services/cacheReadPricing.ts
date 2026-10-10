/** Cache-read ("input cache read") pricing rules, shared by price editors and displays. Mirrors `cacheReadPrice` in the routing builder. */
export const CACHE_READ_DEFAULT_SHARE = 0.25;

export const defaultCacheRead = (input: number) => Math.max(0, Number(input) || 0) * CACHE_READ_DEFAULT_SHARE;

/** Model override → garage tier price → 25 % of input, clamped to 0…input. */
export const effectiveCacheRead = (input: number, modelValue?: number | null, garageValue?: number | null) => {
  const inp = Math.max(0, Number(input) || 0);
  const raw = modelValue ?? garageValue ?? defaultCacheRead(inp);
  return Math.min(Math.max(0, Number(raw) || 0), inp);
};

/** Empty = use the default. Returns an error message, or null when valid. */
export const cacheReadError = (value: string, input: number): string | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "Cache read must be 0 or more.";
  if (n > input) return "Cache read may not exceed the input price.";
  return null;
};

export const parseCacheRead = (value: string): number | null => (value.trim() === "" ? null : Number(value));
