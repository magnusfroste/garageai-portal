import { creditsText } from "@/models/services/credits";
import { PieChart as PieIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ModelUsage } from "@/models/types/usage.types";

interface ModelSpendChartProps {
  data: ModelUsage[];
  loading: boolean;
}

// Use semantic tokens via inline HSL refs (recharts needs string colors)
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(199 89% 48%)",
  "hsl(0 72% 60%)",
  "hsl(48 96% 53%)",
];

const formatModel = (m: string) => {
  if (!m) return "unknown";
  if (m.length <= 28) return m;
  return `…${m.slice(-26)}`;
};

export const ModelSpendChart = ({ data, loading }: ModelSpendChartProps) => {
  // Take top 7, group rest as "other"
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const restCost = rest.reduce((sum, m) => sum + m.cost, 0);
  const restTokens = rest.reduce((sum, m) => sum + m.tokens, 0);
  const restReqs = rest.reduce((sum, m) => sum + m.requests, 0);
  const chartData = restCost > 0
    ? [...top, { model: `Other (${rest.length})`, cost: restCost, tokens: restTokens, requests: restReqs }]
    : top;

  const total = chartData.reduce((sum, m) => sum + m.cost, 0);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieIcon className="w-5 h-5 text-primary" />
          Spend by Model
        </CardTitle>
        <CardDescription>Where your credits go (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : chartData.length === 0 || total === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No model usage yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="cost"
                nameKey="model"
                cx="40%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name, item) => {
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                  const reqs = (item?.payload as { requests?: number })?.requests ?? 0;
                  return [`${creditsText(value.toFixed(6))} (${pct}%) · ${reqs} req`, item?.payload?.model];
                }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-foreground">{formatModel(value)}</span>
                )}
                wrapperStyle={{ fontSize: 11, paddingLeft: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
