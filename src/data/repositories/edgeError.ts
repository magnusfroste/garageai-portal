// Extracts a readable message from Error instances and PostgrestError-like plain objects.
export function errorMessage(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" && (e as { message: string }).message) return (e as { message: string }).message;
  return fallback;
}
