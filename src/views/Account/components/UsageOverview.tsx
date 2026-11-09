import { creditsText } from "@/models/services/credits";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ModelUsage } from "@/models/types/usage.types";

interface UsageOverviewProps {
  usageByModel: ModelUsage[];
  totalSpend: number;
  loading: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(160, 55%, 45%)",
];

export const UsageOverview = ({ usageByModel, totalSpend, loading }: UsageOverviewProps) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>Spend distribution across models</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{creditsText(totalSpend.toFixed(4))}</p>
            <p className="text-xs text-muted-foreground">Total spend</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <BarChart3 className="w-6 h-6 animate-pulse mr-2" />
            Loading usage data...
          </div>
        ) : usageByModel.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No usage data yet</p>
            <p className="text-xs">Start making API calls to see your usage here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={usageByModel} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => `${creditsText(v.toFixed(4))}`} fontSize={12} />
              <YAxis
                type="category"
                dataKey="model"
                width={140}
                fontSize={12}
                tickFormatter={(v) => v.length > 20 ? v.slice(0, 18) + "…" : v}
              />
              <Tooltip
                formatter={(value: number) => [`${creditsText(value.toFixed(6))}`, "Spend"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                {usageByModel.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
