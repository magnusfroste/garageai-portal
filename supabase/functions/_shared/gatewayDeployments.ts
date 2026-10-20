/** The caller-filtered /model/info hides mine routes even from the master key.
 * Reconciliation must use the paginated admin endpoint, or it re-adds invisible ids forever.
 */
export async function readGatewayDeployments<T>(base: string, masterKey: string): Promise<T[]> {
  const deployments: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const res = await fetch(`${base}/v2/model/info?page=${page}&size=100`, { headers: { Authorization: `Bearer ${masterKey}` } });
    if (!res.ok) throw new Error(`Gateway deployment inventory unavailable (${res.status})`);
    const body = await res.json();
    if (!Array.isArray(body.data)) throw new Error('Invalid gateway deployment inventory');
    deployments.push(...body.data);
    if (page >= Number(body.total_pages ?? 1)) return deployments;
  }
  throw new Error('Gateway deployment inventory exceeded page limit');
}