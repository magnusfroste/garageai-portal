import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { useMyGarages } from "@/hooks/useMyGarages";
import { useProfile } from "@/hooks/useProfile";
import { t } from "@/i18n";
export const SetupChecklist = ({ hasKey, hasRequest }: { hasKey: boolean; hasRequest: boolean }) => {
  const { garages, isLoading } = useMyGarages();
  const { profile } = useProfile();
  const steps = [
    { title: "API key", done: hasKey, to: "/dashboard/keys", state: hasKey ? "Ready" : "Create a key" },
    { title: "First request", done: hasRequest, to: "/dashboard/api", state: hasRequest ? "Completed" : "Send a request" },
    { title: "Top up", done: Number(profile?.purchased_credits_usd ?? 0) > 0, to: "/dashboard/credits", state: "Add credits" },
    { title: "Offer your GPU", done: garages.some(g => g.status === "online" && !g.disabled), to: garages.length ? "/dashboard/garages" : "/dashboard/offer-gpu", state: isLoading ? "Loading…" : garages.some(g => g.status === "online" && !g.disabled) ? "Live" : garages.length ? "Needs attention" : "Not connected" },
  ];
  return <section className="space-y-3"><h2 className="text-lg font-semibold">{t("Setup checklist")}</h2><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{steps.map(s => <Link key={s.title} to={s.to} className="flex items-center gap-3 border-b border-border py-3 hover:text-primary">{s.done ? <CheckCircle2 className="w-5 h-5 shrink-0 text-primary"/> : <Circle className="w-5 h-5 shrink-0 text-muted-foreground"/>}<div><p className="text-sm font-medium">{t(s.title)}</p><p className="text-xs text-muted-foreground">{t(s.state)}</p></div></Link>)}</div></section>;
};