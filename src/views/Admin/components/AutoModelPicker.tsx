import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { autoModelOptions, filterAutoModelOptions } from "@/models/services/autoRouteService";
import { formatContext } from "@/models/services/catalogService";
import type { CuratedModel } from "@/models/types/curatedModel.types";
import type { AutoRouteEntry } from "@/models/types/autoRoute.types";
import { cn } from "@/lib/utils";

interface Props {
  models: CuratedModel[];
  entries: AutoRouteEntry[];
  value: string;
  onSelect: (id: string) => void;
  currentEntryId?: string;
  disabled?: boolean;
}

export function AutoModelPicker({ models, entries, value, onSelect, currentEntryId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = autoModelOptions(models, entries, currentEntryId);
  const selected = options.find((o) => o.model.id === value);
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label={currentEntryId ? "Change model" : "Add a model"} disabled={disabled} className="w-full justify-between gap-2 font-normal sm:w-96">
          <span className="min-w-0 truncate">{selected ? `${selected.name} · ${selected.supplier} · ${selected.tier}` : value || "Add a model"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(560px,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search models or garages/providers…" />
          <CommandList className="max-h-96">
            <CommandEmpty>No models found</CommandEmpty>
            <CommandGroup>
              {filterAutoModelOptions(options, query).map((o) => (
                <CommandItem key={o.model.id} value={o.model.id} disabled={o.disabled} onSelect={() => { onSelect(o.model.id); setOpen(false); setQuery(""); }} className="items-start gap-2 py-2 data-[selected=true]:bg-muted data-[selected=true]:text-foreground">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === o.model.id ? "opacity-100" : "opacity-0")} />
                  <span className={cn("min-w-0 flex-1", (o.down || o.alreadyInAuto) && "text-muted-foreground")}>
                    <span className="block break-words text-sm font-medium">{o.name}</span>
                    <span className="block break-words text-xs text-muted-foreground">{o.supplier} · {o.tier} · {o.inputLabel} / {o.outputLabel} credits/M input / output · {formatContext(o.model.max_input_tokens)} context</span>
                    {(o.alreadyInAuto || o.down) && <span className="block text-xs">{[o.alreadyInAuto && "already in auto", o.down && "down"].filter(Boolean).join(" · ")}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}