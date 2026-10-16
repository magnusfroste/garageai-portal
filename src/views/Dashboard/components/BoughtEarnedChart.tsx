import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { DayPoint } from "@/models/services/overviewService";
import { t } from "@/i18n";

export const BoughtEarnedChart = ({ data, showEarned }: { data: DayPoint[]; showEarned: boolean }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-medium text-muted-foreground">{t("Last 14 days")}</h2>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" fontSize={11} tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} width={48} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(v: number, n: string) => [`$${v.toFixed(4)}`, n]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="bought" name={t("Bought")} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        {showEarned && <Line type="monotone" dataKey="earned" name={t("Earned")} stroke="hsl(var(--success))" strokeWidth={2} dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  </section>
);
