import { useState } from "react";
import { Check, ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { ModelInfo } from "@/models/types/model.types";
import { orderChatModels } from "@/models/services/chatService";
import { poolSummaryText } from "@/models/services/reliabilityService";
import { useToolSupport } from "@/hooks/useToolSupport";
import { useModelGarageGrades } from "@/hooks/useGarageReliability";
import { GradeBadge } from "@/views/Garages/components/Reliability";

interface Props {
  models: ModelInfo[];
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const label = (m: ModelInfo) => {
  if (m.garage_tier === "dedicated" && m.garage) {
    const prefix = `garage/${m.garage}/`;
    const base = (m.model_name || m.id).startsWith(prefix) ? (m.model_name || m.id).slice(prefix.length) : m.model_name || m.id;
    return base;
  }
  return m.model_name || m.id;
};

export const ChatModelPicker = ({ models, selected, onSelect, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const { gradeOf, poolSummary } = useModelGarageGrades();
  const { supportsTools } = useToolSupport();
  const { pool, garage } = orderChatModels(models);
  const current = models.find((m) => m.id === selected);

  const item = (m: ModelInfo) => (
    <CommandItem
      key={m.id}
      value={`${m.id} ${m.garage ?? ""}`}
      onSelect={() => { onSelect(m.id); setOpen(false); }}
      className="gap-2"
    >
      <Check className={cn("h-3.5 w-3.5 shrink-0", m.id === selected ? "opacity-100" : "opacity-0")} />
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", m.status === "healthy" ? "bg-primary" : m.status === "unhealthy" ? "bg-destructive" : "bg-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{label(m)}</span>
      {m.garage_tier === "dedicated" ? (
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          {m.garage}{gradeOf(m.garage) && <GradeBadge grade={gradeOf(m.garage)!} />}
        </span>
      ) : (() => {
        const p = poolSummary(m.model_name || m.id);
        return p ? <span className="shrink-0 text-[10px] text-muted-foreground">{poolSummaryText(p.count, p.best)}</span> : null;
      })()}
      {supportsTools(m.id) && <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t("Supports tools")} />}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" disabled={disabled} className="h-9 max-w-[60vw] gap-1.5 px-2 text-base font-semibold" aria-label={t("Choose model")}>
          <span className="truncate">{current ? label(current) : t("Choose model")}</span>
          {current?.garage_tier === "dedicated" && <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">· {current.garage}</span>}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,92vw)] p-0">
        <Command>
          <CommandInput placeholder={t("Search models…")} />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>{t("No models found")}</CommandEmpty>
            {pool.length > 0 && <CommandGroup heading={t("Pool – we pick the best available garage")}>{pool.map(item)}</CommandGroup>}
            {garage.length > 0 && <CommandGroup heading={t("Specific garage")}>{garage.map(item)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
