import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Zap } from "lucide-react";

interface MonthlyBucket {
  label: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface MonthlyUsageChartProps {
  logs: { startTime?: string; total_tokens?: number; spend?: number }[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MonthlyUsageChart = ({ logs }: MonthlyUsageChartProps) => {
  const data = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, MonthlyBucket> = {};

    // Create last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = {
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        tokens: 0,
        cost: 0,
        requests: 0,
      };
    }

    for (const log of logs) {
      if (!log.startTime) continue;
      const d = new Date(log.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (buckets[key]) {
        buckets[key].tokens += Number(log.total_tokens || 0);
        buckets[key].cost += Number(log.spend || 0);
        buckets[key].requests += 1;
      }
    }

    return Object.values(buckets);
  }, [logs]);

  const totalTokens = data.reduce((s, d) => s + d.tokens, 0);
  const currentMonth = data[data.length - 1];
  const prevMonth = data[data.length - 2];
  const growth =
    prevMonth && prevMonth.tokens > 0
      ? ((currentMonth.tokens - prevMonth.tokens) / prevMonth.tokens) * 100
      : null;

  const formatTokens = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}K`
        : v.toString();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="text-accent font-medium">{formatTokens(payload[0].value)}</span> tokens
          </p>
          {payload[0]?.payload?.requests > 0 && (
            <p className="text-xs text-muted-foreground">
              {payload[0].payload.requests} requests · ${payload[0].payload.cost.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-accent" />
              <p className="text-sm font-medium text-muted-foreground">
                Monthly Token Usage
              </p>
            </div>
            <p className="text-2xl font-bold tracking-tight">
              {formatTokens(totalTokens)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                last 6 months
              </span>
            </p>
          </div>
          {growth !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                growth >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              <TrendingUp
                className={`w-3 h-3 ${growth < 0 ? "rotate-180" : ""}`}
              />
              {Math.abs(growth).toFixed(0)}%
            </div>
          )}
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={28}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(193, 95%, 68%)" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(240, 5%, 15%)"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(240, 5%, 55%)" }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(240, 5%, 45%)" }}
                tickFormatter={formatTokens}
                width={45}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "hsl(240, 5%, 10%)", radius: 4 }}
              />
              <Bar
                dataKey="tokens"
                fill="url(#barGradient)"
                radius={[6, 6, 0, 0]}
                animationDuration={800}
                animationBegin={100}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
