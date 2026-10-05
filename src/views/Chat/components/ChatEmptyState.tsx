import { t } from "@/i18n";

const PROMPTS = [
  "Explain how a GPU runs a language model, in simple terms",
  "Write a Python function that removes duplicates from a list",
  "Summarise the pros and cons of running AI locally",
  "Draft a short, friendly email asking for a meeting",
];

export const ChatEmptyState = ({ onPick }: { onPick: (text: string) => void }) => (
  <div className="text-center">
    <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("What can I help you with?")}</h1>
    <div className="mx-auto mt-4 grid max-w-[640px] gap-2 sm:grid-cols-2">
      {PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(t(p))}
          className="rounded-xl border border-border/70 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
        >
          {t(p)}
        </button>
      ))}
    </div>
  </div>
);
