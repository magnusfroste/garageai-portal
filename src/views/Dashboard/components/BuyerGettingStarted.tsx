import { KeyRound, MessageSquare, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  { label: "Skapa en API-nyckel", path: "/dashboard/keys", icon: KeyRound },
  { label: "Testa i chatten", path: "/dashboard/chat", icon: MessageSquare },
  { label: "Anslut din kod", path: "/dashboard/api", icon: Terminal },
];

export const BuyerGettingStarted = () => {
  const navigate = useNavigate();
  return (
    <section className="border-b border-border/50 pb-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Kom igång</h2>
        <p className="text-sm text-muted-foreground">Tre steg till ditt första AI-anrop.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Button key={step.path} variant="outline" className="h-auto justify-start py-3" onClick={() => navigate(step.path)}>
            <step.icon className="mr-2 h-4 w-4 text-primary" />{index + 1}. {step.label}
          </Button>
        ))}
      </div>
    </section>
  );
};