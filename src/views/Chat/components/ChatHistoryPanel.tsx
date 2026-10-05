import { useState } from "react";
import { MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { groupByBucket, type HistoryBucket } from "@/models/services/chatService";
import type { Conversation } from "../types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const LABELS: Record<HistoryBucket, string> = { today: "Today", yesterday: "Yesterday", earlier: "Earlier" };

const Row = ({ c, active, onSelect, onRename, onDelete }: { c: Conversation; active: boolean } & Pick<Props, "onSelect" | "onRename" | "onDelete">) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== c.title) onRename(c.id, draft); };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(c.title); } }}
        className="w-full rounded-md border border-primary/50 bg-background px-2 py-1.5 text-sm focus:outline-none"
        aria-label={t("Rename")}
      />
    );
  }
  return (
    <div className={cn("group flex items-center rounded-md", active ? "bg-muted" : "hover:bg-muted/60")}>
      <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm">
        {c.title === "New chat" ? t("New chat") : c.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={t("Conversation options")}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setDraft(c.title); setEditing(true); }}><Pencil className="mr-2 h-3.5 w-3.5" />{t("Rename")}</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(c.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />{t("Delete")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const PanelBody = (p: Props) => {
  const groups = groupByBucket(p.conversations);
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={p.onNew}>
          <SquarePen className="h-4 w-4" /> {t("New chat")}
          <kbd className="ml-auto text-[10px] text-muted-foreground">⌘K</kbd>
        </Button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4" aria-label={t("Chat history")}>
        {p.conversations.length === 0 && <p className="px-2 text-xs text-muted-foreground">{t("No conversations yet")}</p>}
        {(Object.keys(groups) as HistoryBucket[]).map((b) => groups[b].length > 0 && (
          <div key={b}>
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t(LABELS[b])}</p>
            <div className="space-y-0.5">
              {groups[b].map((c) => <Row key={c.id} c={c} active={c.id === p.activeId} onSelect={p.onSelect} onRename={p.onRename} onDelete={p.onDelete} />)}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
};

export const ChatHistoryPanel = ({ open, mobileOpen, onMobileOpenChange, ...p }: Props & { open: boolean; mobileOpen: boolean; onMobileOpenChange: (v: boolean) => void }) => (
  <>
    <aside className={cn("hidden shrink-0 border-r border-border/50 bg-card/30 transition-[width] duration-200 md:block", open ? "w-64" : "w-0 overflow-hidden border-r-0")}>
      <div className="h-full w-64"><PanelBody {...p} /></div>
    </aside>
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">{t("Chat history")}</SheetTitle>
        <PanelBody {...p} onSelect={(id) => { p.onSelect(id); onMobileOpenChange(false); }} onNew={() => { p.onNew(); onMobileOpenChange(false); }} />
      </SheetContent>
    </Sheet>
  </>
);
