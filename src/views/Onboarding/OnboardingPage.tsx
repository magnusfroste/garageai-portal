import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Cpu, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { profileService } from "@/models/services/profileService";
import type { SignupIntent } from "@/models/types/onboarding.types";
import { toast } from "sonner";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const choose = async (intent: SignupIntent | null) => {
    setSaving(true);
    try {
      await profileService.completeOnboarding(intent);
      navigate(intent === "operator" ? "/dashboard/offer-gpu" : "/dashboard", { replace: true });
    } catch {
      toast.error("Kunde inte spara ditt val. Försök igen.");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Vad vill du göra?</h1>
          <p className="text-muted-foreground">Välj en startpunkt. Du kan alltid använda båda delarna senare.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><Bot className="h-6 w-6 text-primary" /><CardTitle>Använda AI</CardTitle><CardDescription>Skapa en nyckel och använd öppna modeller via API eller chatt.</CardDescription></CardHeader>
            <CardContent><Button className="w-full" disabled={saving} onClick={() => choose("buyer")}>Kom igång med AI</Button></CardContent>
          </Card>
          <Card>
            <CardHeader><Cpu className="h-6 w-6 text-primary" /><CardTitle>Erbjuda min GPU</CardTitle><CardDescription>Anslut din maskin som ett garage och erbjud modellkapacitet.</CardDescription></CardHeader>
            <CardContent><Button className="w-full" disabled={saving} onClick={() => choose("operator")}>Anslut en GPU</Button></CardContent>
          </Card>
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" disabled={saving} onClick={() => choose(null)}>
            <LayoutDashboard className="mr-2 h-4 w-4" />Båda – visa mig runt
          </Button>
        </div>
      </div>
    </main>
  );
};