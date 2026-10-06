import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Wallet, RefreshCw, AlertTriangle, XCircle, Flame, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserBudget } from "@/models/types/userBudget.types";

interface UserBudgetCardProps {
  budget: UserBudget | null;
  loading: boolean;
  onRefresh: () => void;
}

export const UserBudgetCard = ({ budget, loading, onRefresh }: UserBudgetCardProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="glass-card">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!budget) return null;

  const usagePercent = budget.max_budget > 0
    ? (budget.spend / budget.max_budget) * 100
    : 0;

  const budgetWarning = usagePercent >= 100
    ? { level: "critical" as const, icon: XCircle, title: "Budget exhausted", description: `You've used 100% of your $${budget.max_budget.toFixed(2)} budget. Purchase more credits to continue using the API.`, className: "border-destructive/60 bg-destructive/10 text-destructive" }
    : usagePercent >= 90
    ? { level: "danger" as const, icon: Flame, title: "Budget almost depleted", description: `You've used ${usagePercent.toFixed(1)}% of your budget. Only $${budget.budget_remaining.toFixed(2)} remaining.`, className: "border-orange-500/60 bg-orange-500/10 text-orange-400" }
    : usagePercent >= 80
    ? { level: "warning" as const, icon: AlertTriangle, title: "Approaching budget limit", description: `You've used ${usagePercent.toFixed(1)}% of your budget. Consider purchasing additional credits soon.`, className: "border-yellow-500/60 bg-yellow-500/10 text-yellow-400" }
    : null;

  const progressColor = usagePercent >= 100
    ? "[&>div]:bg-destructive"
    : usagePercent >= 90
    ? "[&>div]:bg-orange-500"
    : usagePercent >= 80
    ? "[&>div]:bg-yellow-500"
    : "[&>div]:bg-primary";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Account Budget</h2>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {budgetWarning && (
        <Alert className={`${budgetWarning.className} animate-in fade-in slide-in-from-top-2 duration-300`}>
          <budgetWarning.icon className="h-4 w-4" />
          <AlertTitle className="font-semibold">{budgetWarning.title}</AlertTitle>
          <AlertDescription className="opacity-90 flex items-center justify-between gap-4">
            <span>{budgetWarning.description}</span>
            <Link to="/dashboard/credits" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap shrink-0">
              Buy credits <ArrowRight className="h-3 w-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${budget.max_budget.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Trial + purchased credits
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${budget.spend.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all API keys
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${usagePercent >= 90 ? "text-destructive" : "text-accent"}`}>
              ${budget.budget_remaining.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available to spend
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Budget usage</span>
          <span className="font-medium">{usagePercent.toFixed(1)}%</span>
        </div>
        <Progress value={Math.min(usagePercent, 100)} className={`h-2 ${progressColor}`} />
      </div>
    </div>
  );
};
