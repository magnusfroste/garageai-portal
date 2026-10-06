import { t } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";
import { ModelUsage } from "@/models/types/usage.types";

const COLORS = [
  "hsl(45, 90%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(160, 55%, 50%)",
  "hsl(210, 70%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(30, 75%, 55%)",
];

interface ActivityCardProps {
  title: string;
  value: string;
  data: { name: string; value: number }[];
  formatLegend?: (v: number) => string;
}

export const ActivityCard = ({ title, value, data, formatLegend }: ActivityCardProps) => {
  const top3 = data.slice(0, 3);
  const othersValue = data.slice(3).reduce((sum, d) => sum + d.value, 0);
  const legendItems = othersValue > 0
    ? [...top3, { name: "Others", value: othersValue }]
    : top3;
  const fmt = formatLegend || ((v: number) => v.toLocaleString());

  return (
    <Card className="glass-card flex flex-col">
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm text-muted-foreground font-medium">{t(title)}</p>
        </div>
        <p className="text-2xl font-bold tracking-tight mb-4">{value}</p>

        {data.length > 0 ? (
          <>
            <div className="h-24 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 mt-auto">
              {legendItems.map((item, i) => (
                <div key={t(item.name)} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: i < 3 ? COLORS[i] : "hsl(var(--muted-foreground))" }}
                    />
                    <span className="truncate text-muted-foreground">{t(item.name)}</span>
                  </div>
                  <span className="font-medium tabular-nums ml-2">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            {t("No data yet")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
