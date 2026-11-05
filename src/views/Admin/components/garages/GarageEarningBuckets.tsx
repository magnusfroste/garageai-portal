import { useEarningBuckets } from "@/hooks/useEarningBuckets";
import { t } from "@/i18n";

const usd = (v: number) => `$${Number(v).toFixed(Number(v) < 1 ? 4 : 2)}`;

/** Who paid for this month's traffic: only payable earns. */
export const GarageEarningBuckets = ({ garageId }: { garageId: string }) => {
  const { data, isError, isLoading } = useEarningBuckets(garageId);
  if (isLoading) return null;
  if (isError || !data) return <p className="text-xs text-destructive">{t("Could not load earnings.")}</p>;
  const rows: Array<[string, number, number]> = [[t("Payable (earns)"), data.payable_spend_usd, data.payable_requests], [t("Trial credit"), data.trial_spend_usd, data.trial_requests], [t("Operator's own"), data.own_spend_usd, data.own_requests]];
  return (
    <div className="space-y-2">
      <table className="w-full text-sm tabular-nums"><tbody>
        {rows.map(([label, spend, n]) => <tr key={label}><td className="py-0.5 admin-meta">{label}</td><td className="py-0.5 text-right">{usd(spend)}</td><td className="py-0.5 text-right text-muted-foreground">{t("{n} requests", { n: Number(n).toLocaleString() })}</td></tr>)}
      </tbody></table>
      <p className="text-xs text-muted-foreground">{t("Distinct buyers this month: {n}", { n: data.buyer_users })}</p>
    </div>
  );
};
