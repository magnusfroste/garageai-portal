import { useState } from "react";
import { Key, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiKeyService } from "@/models/services/apiKeyService";
import { t } from "@/i18n";

export interface ChatKeyOption { id: string; name: string; is_active: boolean }

interface Props {
  keys: ChatKeyOption[];
  selected: string;
  onSelect: (id: string) => void;
  onCreated: () => Promise<unknown>;
  isAdmin?: boolean;
  disabled?: boolean;
}

const CreateKey = ({ onCreated, compact }: { onCreated: () => Promise<unknown>; compact?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(t("Chat"));
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await apiKeyService.createKey({ keyName: name.trim() || "Chat" });
      await onCreated();
      toast.success(t("API key created"));
      setOpen(false);
    } catch {
      toast.error(t("Couldn't create API key"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={compact ? "ghost" : "outline"} size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> {compact ? "" : t("Create API key")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-sm font-medium">{t("New API key")}</p>
        <p className="text-xs text-muted-foreground">{t("The chat uses one of your API keys, so usage shows up under that key.")}</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} aria-label={t("Key name")} />
        <Button size="sm" className="w-full" disabled={busy} onClick={create}>{busy ? t("Creating…") : t("Create")}</Button>
      </PopoverContent>
    </Popover>
  );
};

export const ChatKeyPicker = ({ keys, selected, onSelect, onCreated, isAdmin, disabled }: Props) => {
  const active = keys.filter((k) => k.is_active);
  if (active.length === 0 && !isAdmin) return <CreateKey onCreated={onCreated} />;
  return (
    <div className="flex items-center gap-0.5">
      <Select value={selected} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger className="h-8 w-auto max-w-[160px] gap-1.5 border-none bg-transparent px-2 text-xs text-muted-foreground hover:text-foreground" aria-label={t("API key")}>
          <Key className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder={t("Select key…")} />
        </SelectTrigger>
        <SelectContent align="end">
          {isAdmin && <SelectItem value="__master__"><span className="text-xs">{t("Master key (admin)")}</span></SelectItem>}
          {active.map((k) => <SelectItem key={k.id} value={k.id}><span className="text-xs">{k.name}</span></SelectItem>)}
        </SelectContent>
      </Select>
      <CreateKey onCreated={onCreated} compact />
    </div>
  );
};
