// Reads every gateway user's spend in a few paged /user/list calls instead of one /user/info call per account.
export function parseUserListPage(d: unknown): { spend: Map<string, number>; more: boolean } | null {
  const body = d as { users?: unknown; total_pages?: unknown; page?: unknown } | null;
  if (!body || !Array.isArray(body.users)) return null;
  const spend = new Map<string, number>();
  for (const u of body.users as Array<{ user_id?: unknown; spend?: unknown }>) if (typeof u?.user_id === "string" && typeof u.spend === "number" && Number.isFinite(u.spend)) spend.set(u.user_id, u.spend);
  const page = Number(body.page ?? 1), pages = Number(body.total_pages ?? 1);
  return { spend, more: Number.isFinite(page) && Number.isFinite(pages) && page < pages };
}

export async function allUserSpend(base: string, key: string, fetchFn: typeof fetch = fetch, maxPages = 50): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchFn(`${base}/user/list?page=${page}&page_size=100`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const parsed = parseUserListPage(await res.json());
    if (!parsed) return null;
    for (const [id, s] of parsed.spend) out.set(id, s);
    if (!parsed.more) return out;
  }
  return out;
}
