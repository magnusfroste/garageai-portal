import type { CatalogModel } from "@/models/types/catalog.types";
import { t } from "@/i18n";

/** Operator view: this garage's share of each pool it is in (weight / sum of weights). */
export const PoolShareNote = ({ garage, catalog }: { garage: string; catalog: CatalogModel[] }) => {
  const pools = catalog.flatMap((m) => {
    const me = m.pool?.members.find((x) => x.garage === garage);
    return me && m.pool ? [{ name: m.name, others: m.pool.members.length - 1, share: me.share }] : [];
  });
  if (!pools.length) return null;
  return (
    <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2 text-xs">
      {pools.map((p) => (
        <p key={p.name}>
          <span className="font-mono">{p.name}</span>: {t("Your model is in the pool with {n} other garages. A lower price gives a larger share.", { n: p.others })}{" "}
          <span className="font-medium tabular-nums">{t("Your share: {pct}", { pct: `${Math.round(p.share * 100)}%` })}</span>
        </p>
      ))}
    </div>
  );
};
