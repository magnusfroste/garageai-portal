import { useState, type ReactNode } from "react";
import { ChevronDown, LayoutList, Table2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** Collapsible left-panel filter group (OpenRouter-style). */
export const FilterGroup = ({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between px-0 py-1.5 text-sm font-medium tracking-normal text-foreground hover:bg-muted hover:text-foreground">
        {t(title)}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
};

/** Single-choice option row; clicking the active one clears it. */
export const FilterOption = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <Button type="button" variant="ghost" onClick={onClick} aria-pressed={active}
    className={cn("h-auto w-full justify-start whitespace-normal px-2 py-1.5 text-left text-sm font-normal tracking-normal hover:bg-muted hover:text-foreground", active ? "bg-primary/10 text-foreground" : "text-muted-foreground")}>
    {children}
  </Button>
);

export type ViewMode = "list" | "table";
export const ViewToggle = ({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) => (
  <ToggleGroup type="single" size="sm" value={value} onValueChange={(v) => v && onChange(v as ViewMode)} aria-label={t("View")}>
    <ToggleGroupItem value="list" aria-label={t("List")}><LayoutList className="h-4 w-4" /></ToggleGroupItem>
    <ToggleGroupItem value="table" aria-label={t("Table")}><Table2 className="h-4 w-4" /></ToggleGroupItem>
  </ToggleGroup>
);
