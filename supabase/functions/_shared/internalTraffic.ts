// Matches plain names and the internal "<uid8>-<slug>-<rand>" gateway aliases.
export const internalAlias = (alias: unknown): boolean => typeof alias === "string" && /^([0-9a-f]{8}-)?(test|probe|ops)/i.test(alias);
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};
export function taggedInternal(row: Record<string, unknown>): boolean {
  const meta = object(row.metadata);
  let tags = row.request_tags ?? meta.tags;
  if (typeof tags === "string") { try { tags = JSON.parse(tags); } catch { tags = [tags]; } }
  return meta.internal === true || internalAlias(row.key_alias ?? meta.key_alias) ||
    (Array.isArray(tags) && tags.some(t => /^(acceptance-test|platform|test|probe|ops|admin-measurement)/i.test(String(t))));
}
export async function fingerprint(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

/** Identities and aliases come from trusted server-side key records, never the buyer payload. */
export function countsAsDemand(row: Record<string, unknown>, identities: ReadonlySet<string>): boolean {
  return !taggedInternal(row) && !(typeof row.api_key === "string" && identities.has(row.api_key));
}

export async function loadInternalIdentities(admin: any, base: string, master: string, rows: Record<string, unknown>[]): Promise<Set<string>> {
  const identities = new Set<string>([master, await fingerprint(master)]);
  const knownCustomer = new Set<string>();
  const { data: keys, error } = await admin.from("api_keys").select("key_value,litellm_token,name,internal");
  if (error) throw new Error("Cannot classify API keys");
  for (const k of keys ?? []) {
    if (!k.internal && !internalAlias(k.name)) {
      for (const value of [k.key_value, k.litellm_token]) if (value) { knownCustomer.add(value); knownCustomer.add(await fingerprint(value)); }
      continue;
    }
    for (const value of [k.key_value, k.litellm_token]) if (value) { identities.add(value); identities.add(await fingerprint(value)); }
  }
  const records = [{ fingerprint: await fingerprint(master), alias: "gateway / acceptance-test", internal: true, checked_at: new Date().toISOString() }];
  const unique = [...new Set(rows.map(r => r.api_key).filter((k): k is string => typeof k === "string" && !!k))];
  for (const key of unique) {
    const hash = await fingerprint(key);
    const { data: cached, error: cacheError } = await admin.from("gateway_key_records").select("internal,alias").eq("fingerprint", hash).maybeSingle();
    if (cacheError) throw new Error("Cannot read key classification");
    if (identities.has(key) || cached?.internal) { identities.add(key); continue; }
    // Refresh aliases, including keys created outside the portal. Do not log key/info URLs or responses.
    const res = await fetch(`${base}/key/info?key=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${master}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok && res.status !== 404) throw new Error("Gateway key classification unavailable");
    const body = res.ok ? await res.json() : {};
    const info = body.info ?? body;
    const alias = info.key_alias ?? cached?.alias ?? "";
    // A deleted/unknown gateway-only key cannot establish genuine buyer demand.
    const internal = identities.has(key) || internalAlias(alias) || info.metadata?.internal === true || (res.status === 404 && !knownCustomer.has(key));
    if (internal) identities.add(key);
    if (internal) {
      for (const column of ["litellm_token", "key_value"]) {
        const { error } = await admin.from("api_keys").update({ internal: true }).eq(column, key);
        if (error) throw new Error("Cannot mark internal API key");
      }
    }
    records.push({ fingerprint: hash, alias: String(alias), internal, checked_at: new Date().toISOString() });
  }
  const { error: saveError } = await admin.from("gateway_key_records").upsert(records, { onConflict: "fingerprint" });
  if (saveError) throw new Error("Cannot save key classification");
  return identities;
}