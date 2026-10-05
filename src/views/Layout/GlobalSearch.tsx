import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Search, Warehouse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { searchCatalog } from "@/models/services/catalogSearch";

export const GlobalSearch = ({ modelsHref = "/dashboard/models" }: { modelsHref?: string }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { models } = useCuratedModels(true);
  const { reliability } = useGarageReliability();

  const hits = useMemo(
    () => searchCatalog(q, models.map((m) => m.model_name), [...reliability.keys()], modelsHref),
    [q, models, reliability, modelsHref],
  );

  const go = (href: string) => {
    setQ("");
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="relative w-full max-w-xs">
      <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) go(hits[0].href); }}
        placeholder="Sök modeller och garage"
        className="h-8 pl-8 text-sm"
        aria-label="Sök modeller och garage"
      />
      {open && q.trim() && (
        <div className="absolute mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md z-50 py-1">
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Inga träffar</p>
          ) : hits.map((h) => (
            <button
              key={h.kind + h.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(h.href)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent"
            >
              {h.kind === "model" ? <Cpu className="w-3.5 h-3.5 text-muted-foreground" /> : <Warehouse className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="truncate font-mono text-xs">{h.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{h.kind === "model" ? "Modell" : "Garage"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
