import { useState } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { CalendarIcon, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardData } from "./hooks/useDashboardData";
import { useAccountData } from "@/views/Account/hooks/useAccountData";
import { ActivityCard } from "./components/ActivityCard";
import { MonthlyUsageChart } from "./components/MonthlyUsageChart";
import { DailySpendChart } from "@/views/Account/components/DailySpendChart";
import { BuyerGettingStarted } from "./components/BuyerGettingStarted";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "This month", fromDate: () => startOfMonth(new Date()) },
  { label: "All", days: null },
] as const;

export const DashboardActivity = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { loading: keysLoading } = useDashboardData();

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<string>("Alla");

  const { usageByModel, totalSpend, allLogs, dailyBreakdown, loading: usageLoading } = useAccountData({
    startDate,
    endDate,
  });

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setActivePreset(preset.label);
    if (preset.label === "All") {
      setStartDate(undefined);
      setEndDate(undefined);
    } else if ("fromDate" in preset) {
      setStartDate(preset.fromDate());
      setEndDate(new Date());
    } else if (preset.days) {
      setStartDate(subDays(new Date(), preset.days));
      setEndDate(new Date());
    }
  };

  const handleCustomDate = (type: "start" | "end", date: Date | undefined) => {
    setActivePreset("");
    if (type === "start") setStartDate(date);
    else setEndDate(date);
  };

  if (profileLoading || keysLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalRequests = usageByModel.reduce((s, m) => s + m.requests, 0);
  const totalTokens = usageByModel.reduce((s, m) => s + m.tokens, 0);

  const spendData = usageByModel.map((m) => ({ name: m.model, value: m.cost }));
  const requestData = usageByModel
    .map((m) => ({ name: m.model, value: m.requests }))
    .sort((a, b) => b.value - a.value);
  const tokenData = usageByModel
    .map((m) => ({ name: m.model, value: m.tokens }))
    .sort((a, b) => b.value - a.value);

  const formatTokens = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toString();

  return (
    <div className="p-6 space-y-8">
      {profile?.signup_intent === "buyer" && <BuyerGettingStarted />}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Din användning av modeller på GarageAI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={activePreset === p.label ? "default" : "outline"}
              onClick={() => applyPreset(p)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn("text-xs gap-1.5", startDate && "text-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {startDate ? format(startDate, "d MMM") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => handleCustomDate("start", d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn("text-xs gap-1.5", endDate && "text-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {endDate ? format(endDate, "d MMM") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => handleCustomDate("end", d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {usageLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground text-sm animate-pulse">Loading usage data...</p>
        </div>
      ) : (
        <>
          <DailySpendChart data={dailyBreakdown} loading={usageLoading} />

          <MonthlyUsageChart logs={allLogs} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActivityCard
              title="Spend"
              value={`$${totalSpend.toFixed(3)}`}
              data={spendData}
              formatLegend={(v) => v.toFixed(4)}
            />
            <ActivityCard
              title="Requests"
              value={totalRequests.toLocaleString()}
              data={requestData}
              formatLegend={(v) => v.toLocaleString()}
            />
            <ActivityCard
              title="Tokens"
              value={formatTokens(totalTokens)}
              data={tokenData}
              formatLegend={formatTokens}
            />
          </div>
        </>
      )}
    </div>
  );
};
