import { creditsText } from "@/models/services/credits";
import { useState } from "react";
import { CreditCard, Zap, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Profile } from "@/models/types/profile.types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubscriptionSectionProps {
  profile: Profile | null;
}

const CREDIT_PACKS = [
  { id: "small", label: "$5", credits: 5, description: "5 credits" },
  { id: "medium", label: "$20", credits: 20, description: "20 credits", popular: true },
  { id: "large", label: "$100", credits: 100, description: "100 credits" },
];

export const SubscriptionSection = ({ profile }: SubscriptionSectionProps) => {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  if (!profile) return null;

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
      toast.error("Failed to start checkout");
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <Badge variant="secondary" className="text-xs">Free Trial</Badge>
          </div>
          <CardDescription>Your subscription and credit usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="w-4 h-4 text-primary" />
              Purchased Credits
            </div>
            <p className="text-2xl font-bold">{creditsText(profile.purchased_credits_usd.toFixed(2))}</p>
            <p className="text-xs text-muted-foreground">
              Purchased credits available for API usage.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Buy Credits</CardTitle>
          <CardDescription>Top up your account with API credits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CREDIT_PACKS.map((pack) => (
            <Button
              key={pack.id}
              variant={pack.popular ? "default" : "outline"}
              className={`w-full justify-between ${pack.popular ? "glow" : ""}`}
              disabled={loadingPack !== null}
              onClick={() => handleBuyCredits(pack.id)}
            >
              <span className="flex items-center gap-2">
                {loadingPack === pack.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {pack.description}
                {pack.popular && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Popular</Badge>
                )}
              </span>
              <span className="font-bold">{pack.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
