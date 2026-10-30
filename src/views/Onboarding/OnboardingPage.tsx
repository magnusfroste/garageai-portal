import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartingPaths } from "./StartingPaths";
import { profileService } from "@/models/services/profileService";
import type { SignupIntent } from "@/models/types/onboarding.types";
import { toast } from "sonner";
import { AccountTermsBanner } from "@/views/Account/components/AccountTermsBanner";
import { TermsAcceptDialog } from "@/views/Account/components/TermsAcceptDialog";

import { t } from "@/i18n";
export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const choose = async (intent: SignupIntent | null) => {
    setSaving(true);
    try {
      await profileService.completeOnboarding(intent);
      navigate(intent === "operator" ? "/connect" : "/dashboard", { replace: true });
    } catch {
      toast.error(t("Could not save your choice. Please try again."));
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <AccountTermsBanner /><TermsAcceptDialog />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t("What do you want to do?")}</h1>
          <p className="text-muted-foreground">{t("Pick a starting point. You can always use both later.")}</p>
        </div>
        <StartingPaths onChoose={async path => {
          if (saving) return;
          setSaving(true);
          try { const operator = path.includes("connect"); await profileService.completeOnboarding(operator ? "operator" : "buyer"); navigate(operator ? path : "/dashboard", { replace: true }); }
          catch { toast.error(t("Could not save your choice. Please try again.")); setSaving(false); }
        }} />
        <div className="flex justify-center">
          <Button variant="ghost" disabled={saving} onClick={() => choose(null)}>
            <LayoutDashboard className="mr-2 h-4 w-4" />{t("Both – show me around")}
          </Button>
        </div>
      </div>
    </main>
  );
};