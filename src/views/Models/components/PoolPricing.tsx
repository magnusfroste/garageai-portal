import { Link } from "react-router-dom";
import type { PoolSummary } from "@/models/services/poolPricing";
import { t } from "@/i18n";

const usd = (n: number) => `$${Number(n.toFixed(4))}`;
const ctx = (n?: number | null) => (!n ? "—" : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** From / expected / cap for a pool model, then its garages like OpenRouter's provider list. */
export const PoolPricing = ({ pool }: { pool: PoolSummary }) => (
  <div className="basis-full space-y-3">
    <div className="grid grid-cols-3 gap-3 text-sm">
      {([["From", pool.from, "The cheapest garage"], ["Expected", pool.expected, "Average weighted by each garage's share"], ["Cap", pool.cap, "The most expensive garage"]] as const).map(([label, p, hint]) => (
        <div key={label} title={t(hint)}>
          <div className="text-xs text-muted-foreground">{t(label)} · {t("in / out per 1M")}</div>
          <div className="tabular-nums">{usd(p.input)} / {usd(p.output)}</div>
        </div>
      ))}
    </div>
    <table className="w-full text-xs">
      <thead className="text-muted-foreground"><tr className="border-b border-border/50 text-left"><th className="py-1 font-normal">{t("Garage")}</th><th className="py-1 font-normal">{t("Price in / out")}</th><th className="py-1 font-normal">{t("Context")}</th><th className="py-1 font-normal text-right">{t("Share")}</th></tr></thead>
      <tbody className="divide-y divide-border/50">
        {pool.members.map((m) => (
          <tr key={m.garage}>
            <td className="py-1.5"><Link to={`/garages/${encodeURIComponent(m.garage)}`} className="font-mono text-primary hover:underline">{m.garage}</Link></td>
            <td className="py-1.5 tabular-nums">{usd(m.input)} / {usd(m.output)}</td>
            <td className="py-1.5 tabular-nums">{ctx(m.context)}</td>
            <td className="py-1.5 text-right tabular-nums">{pct(m.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="text-[11px] text-muted-foreground">{t("Requests are spread over the garages that are up; cheaper garages get a larger share. You pay the price of the garage that answered.")}</p>
  </div>
);
