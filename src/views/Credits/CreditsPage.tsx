import { t } from "@/i18n";
import { useState, useEffect, useRef } from "react";
import { Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/hooks/useProfile";
import { useUserBudget } from "@/hooks/useUserBudget";
import { transactionRepository } from "@/data/repositories/transactionRepository";
import { CreditTransaction } from "@/models/types/transaction.types";
import { supabase } from "@/integrations/supabase/client";

const CREDIT_PACKS = [
  { id: "small", label: "$5", credits: 5, description: "5 credits" },
  { id: "medium", label: "$20", credits: 20, description: "20 credits", popular: true },
  { id: "large", label: "$100", credits: 100, description: "100 credits" },
];

export const CreditsPage = () => {
  const { profile, refetch: refetchProfile } = useProfile();
  const { budget, loading: budgetLoading, refetch: refetchBudget } = useUserBudget();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txError, setTxError] = useState(false);
  const [txLoading, setTxLoading] = useState(true);
  const verifiedRef = useRef(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if (payment === "success" && sessionId && !verifiedRef.current) {
      verifiedRef.current = true;
      toast.loading(t(t("Verifying payment...")), { id: "verify-payment" });

      supabase.functions
        .invoke("verify-payment", { body: { session_id: sessionId } })
        .then(({ data, error }) => {
          if (error || data?.error) {
            toast.error(t(t("Could not verify payment. Contact support if credits are missing.")), { id: "verify-payment" });
          } else if (data?.status === "paid") {
            toast.success(t("Payment verified! {n} credits added.", { n: data.credits_added }), { id: "verify-payment" });
            refetchProfile();
            refetchBudget();
            loadTransactions();
          } else {
            toast.info(t(t("Payment not yet completed.")), { id: "verify-payment" });
          }
        });

      setSearchParams({});
    } else if (payment === "canceled") {
      toast.info(t("Payment was canceled."));
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetchProfile, refetchBudget]);

  const loadTransactions = async () => {
    try {
      setTxLoading(true);
      setTxError(false);
      const data = await transactionRepository.fetchTransactions();
      setTransactions(data);
    } catch (err) {
      setTxError(true);
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuyCredits = async (pack: string) => {
    try {
      setLoadingPack(pack);
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { pack },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(t("Failed to start checkout"));
    } finally {
      setLoadingPack(null);
    }
  };

  const maxBudget = budget?.max_budget ?? 0;
  const spent = budget?.spend ?? 0;
  const remaining = budget?.budget_remaining ?? 0;
  const usagePercent = maxBudget > 0 ? Math.min((spent / maxBudget) * 100, 100) : 0;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">{t("Credits")}</h1>
        <p className="text-muted-foreground text-sm">{t("Manage your API credit balance")}</p>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t("Balance")}</p>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">
              ${budgetLoading ? "—" : remaining.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t("Spent")}</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">
              ${budgetLoading ? "—" : spent.toFixed(4)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{t("Total credit")}</p>
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-primary">
              ${budgetLoading ? "—" : maxBudget.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {!budgetLoading && maxBudget > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("{n}% used", { n: usagePercent.toFixed(1) })}</span>
            <span>${spent.toFixed(4)} / ${maxBudget.toFixed(2)}</span>
          </div>
          <Progress value={usagePercent} className="h-2" />
        </div>
      )}

      {/* Buy Credits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">{t("Add Credits")}</CardTitle>
          <CardDescription>{t("Top up your account with API credits")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {CREDIT_PACKS.map((pack) => (
              <Button
                key={pack.id}
                variant={pack.popular ? "default" : "outline"}
                className={`h-auto py-4 flex flex-col gap-1 ${pack.popular ? "glow" : ""}`}
                disabled={loadingPack !== null}
                onClick={() => handleBuyCredits(pack.id)}
              >
                {loadingPack === pack.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="text-lg font-bold">{pack.label}</span>
                    <span className="text-xs opacity-70">{t("{n} credits", { n: pack.credits })}</span>
                    {pack.popular && (
                      <Badge variant="secondary" className="text-[10px] mt-1">{t("Popular")}</Badge>
                    )}
                  </>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 text-xs text-muted-foreground"><p>{t("Prices in USD, VAT handled per your country at checkout")}</p><p>{t("Stripe sends your receipt by email after checkout. Check your inbox for the receipt link.")}</p></div>
      {/* Transaction History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">{t("Recent Transactions")}</CardTitle>
          <CardDescription>{t("Your credit purchase history")}</CardDescription>
        </CardHeader>
        <CardContent>
          {txError ? <div className="text-sm text-destructive">{t("Could not load purchases.")} <Button variant="link" onClick={loadTransactions}>{t("Try again")}</Button></div> : txLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("Loading...")}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("No purchases yet — choose an amount above to top up.")}</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Date")}</TableHead>
                    <TableHead className="text-right">{t("Amount")}</TableHead>
                    <TableHead className="text-right">{t("Credits")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ${tx.amount_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        +${tx.credits_added.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
