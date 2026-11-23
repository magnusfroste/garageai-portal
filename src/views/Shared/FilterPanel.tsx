import { useState, type ReactNode } from "react";
import { ChevronDown, LayoutList, Table2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** Collapsible left-panel filter group (OpenRouter-style). */
export const FilterGroup = ({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border/50 py-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground">
        {t(title)}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
};

/** Single-choice option row; clicking the active one clears it. */
export const FilterOption = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick}
    className={cn("block w-full rounded px-2 py-1 text-left text-xs transition-colors", active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")}>
    {children}
  </button>
);

export type ViewMode = "list" | "table";
export const ViewToggle = ({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) => (
  <ToggleGroup type="single" size="sm" value={value} onValueChange={(v) => v && onChange(v as ViewMode)} aria-label={t("View")}>
    <ToggleGroupItem value="list" aria-label={t("List")}><LayoutList className="h-4 w-4" /></ToggleGroupItem>
    <ToggleGroupItem value="table" aria-label={t("Table")}><Table2 className="h-4 w-4" /></ToggleGroupItem>
  </ToggleGroup>
);
