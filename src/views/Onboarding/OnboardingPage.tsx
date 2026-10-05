import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Cpu, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { profileService } from "@/models/services/profileService";
import type { SignupIntent } from "@/models/types/onboarding.types";
import { toast } from "sonner";

import { t } from "@/i18n";
export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const choose = async (intent: SignupIntent | null) => {
    setSaving(true);
    try {
      await profileService.completeOnboarding(intent);
      navigate(intent === "operator" ? "/dashboard/offer-gpu" : "/dashboard", { replace: true });
    } catch {
      toast.error(t("Could not save your choice. Please try again."));
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t("What do you want to do?")}</h1>
          <p className="text-muted-foreground">{t("Pick a starting point. You can always use both later.")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><Bot className="h-6 w-6 text-primary" /><CardTitle>{t("Use AI")}</CardTitle><CardDescription>{t("Create a key and use open models via the API or chat.")}</CardDescription></CardHeader>
            <CardContent><Button className="w-full" disabled={saving} onClick={() => choose("buyer")}>{t("Get started with AI")}</Button></CardContent>
          </Card>
          <Card>
            <CardHeader><Cpu className="h-6 w-6 text-primary" /><CardTitle>{t("Offer my GPU")}</CardTitle><CardDescription>{t("Connect your machine as a garage and offer model capacity.")}</CardDescription></CardHeader>
            <CardContent><Button className="w-full" disabled={saving} onClick={() => choose("operator")}>{t("Connect a GPU")}</Button></CardContent>
          </Card>
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" disabled={saving} onClick={() => choose(null)}>
            <LayoutDashboard className="mr-2 h-4 w-4" />{t("Both – show me around")}
          </Button>
        </div>
      </div>
    </main>
  );
};