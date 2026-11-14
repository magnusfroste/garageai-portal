import { Compass, Bot, Cpu, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FirstGoal } from "@/models/services/firstGoal";
import { t } from "@/i18n";

const OPTIONS: Array<{ goal: FirstGoal; label: string; Icon: typeof Bot }> = [
  { goal: "look", label: "Look around", Icon: Compass },
  { goal: "use", label: "Use AI from the garages", Icon: Bot },
  { goal: "own_machine", label: "Use my own computer from anywhere", Icon: Cpu },
  { goal: "share", label: "Share my computer with others", Icon: Users },
];

/** One click answers and continues; Skip stores null. */
export const FirstGoalQuestion = ({ onAnswer, disabled }: { onAnswer: (goal: FirstGoal | null) => void; disabled?: boolean }) => (
  <section aria-labelledby="first-goal-title" className="space-y-4 rounded-lg border border-border bg-card p-5">
    <h2 id="first-goal-title" className="text-xl font-semibold">{t("What do you want to do first?")}</h2>
    <div className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map(({ goal, label, Icon }) => (
        <Button key={goal} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" disabled={disabled} onClick={() => onAnswer(goal)}>
          <Icon className="mr-2 h-4 w-4 shrink-0 text-primary" />{t(label)}
        </Button>
      ))}
    </div>
    <p className="text-xs text-muted-foreground">
      {t("We ask to show you the right first step and to make getting started better. You can change your mind at any time.")}{" · "}
      <button type="button" className="underline disabled:opacity-50" disabled={disabled} onClick={() => onAnswer(null)}>{t("Skip")}</button>
    </p>
  </section>
);
