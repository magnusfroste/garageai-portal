export interface SearchHit {
  kind: "model" | "garage";
  label: string;
  href: string;
}

/** Simple client-side search over model names and garage names. */
export const searchCatalog = (
  query: string,
  modelNames: string[],
  garageNames: string[],
  modelsHref: string,
  limit = 8,
): SearchHit[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const models = [...new Set(modelNames)]
    .filter((n) => n.toLowerCase().includes(q))
    .map<SearchHit>((n) => ({ kind: "model", label: n, href: `${modelsHref}?q=${encodeURIComponent(n)}` }));
  const garages = [...new Set(garageNames)]
    .filter((n) => n.toLowerCase().includes(q))
    .map<SearchHit>((n) => ({ kind: "garage", label: n, href: `/garages/${encodeURIComponent(n)}` }));
  return [...models, ...garages].slice(0, limit);
};
