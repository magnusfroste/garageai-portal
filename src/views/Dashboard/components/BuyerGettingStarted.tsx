import { KeyRound, MessageSquare, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { t } from "@/i18n";
const steps = [
  { label: "Create an API key", path: "/dashboard/keys", icon: KeyRound },
  { label: "Try it in the chat", path: "/dashboard/chat", icon: MessageSquare },
  { label: "Connect your code", path: "/dashboard/api", icon: Terminal },
];

export const BuyerGettingStarted = () => {
  const navigate = useNavigate();
  return (
    <section className="border-b border-border/50 pb-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{t("Get started")}</h2>
        <p className="text-sm text-muted-foreground">{t("Three steps to your first AI request.")}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Button key={step.path} variant="outline" className="h-auto justify-start py-3" onClick={() => navigate(step.path)}>
            <step.icon className="mr-2 h-4 w-4 text-primary" />{index + 1}. {t(step.label)}
          </Button>
        ))}
      </div>
    </section>
  );
};