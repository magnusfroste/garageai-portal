import { useState } from "react";
import { Ban, Check, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ApiKey } from "@/models/types/apiKey.types";
import { t } from "@/i18n";
import type { KeyActivity } from '@/models/types/keyActivity.types';
import { activityCredits, compactTokens, exactUtc, lastUsedText } from '@/models/services/keyActivityService';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ApiKeyCardProps {
  apiKey: ApiKey;
  thisBrowser?: boolean;
  onRevoke?: (keyId: string) => void;
  onRotate?: (keyId: string) => void;
  onRename?: (keyId: string, name: string) => Promise<boolean>;
  busy?: boolean;
  activity?: KeyActivity;
  activityLoading?: boolean;
  onDetails?: () => void;
}

export const ApiKeyCard = ({ apiKey, thisBrowser, onRevoke, onRotate, onRename, busy, activity, activityLoading, onDetails }: ApiKeyCardProps) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(apiKey.name);
  const save = async () => {
    if (!onRename || !name.trim() || name.trim() === apiKey.name) { setEditing(false); setName(apiKey.name); return; }
    if (await onRename(apiKey.id, name.trim())) setEditing(false);
  };
  const isChat = apiKey.kind === "chat";

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4 sm:p-5" onClick={onDetails}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5" onClick={editing ? (e) => e.stopPropagation() : undefined}>
          {editing ? (
            <div className="flex items-center gap-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t("Key name")} className="h-8"
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(apiKey.name); } }} autoFocus />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save} aria-label={t("Save")}><Check className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(false); setName(apiKey.name); }} aria-label={t("Cancel")}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <h3 className="break-words text-base font-semibold">{onDetails ? <Button variant="link" className="h-auto max-w-full justify-start whitespace-normal break-words p-0 text-base font-semibold text-foreground" onClick={(e) => { e.stopPropagation(); onDetails(); }}>{apiKey.name}</Button> : apiKey.name}</h3>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{apiKey.key_last4 ? `…${apiKey.key_last4}` : "…"}</span>
            {isChat && <Badge variant="secondary">{t("chat key")}</Badge>}
            {apiKey.kind === "managed" && <Badge variant="secondary">{t("API")}</Badge>}
            {apiKey.kind === "managed" && !apiKey.is_active && <Badge variant="outline">{t("disabled")}</Badge>}
            {thisBrowser && <Badge variant="outline">{t("this browser")}</Badge>}
            <span>{t("Created {date}", { date: new Date(apiKey.created_at).toLocaleDateString() })}</span>
          </div>
        </div>
        {onDetails && <div className="grid w-full grid-cols-2 gap-4 text-sm sm:w-auto sm:grid-cols-[8rem_12rem]">
          <div><p className="mb-1 text-xs text-muted-foreground sm:hidden">Last used</p>
            {activityLoading ? <span className="text-muted-foreground">Loading…</span> : activity?.infoAvailable ? activity.lastUsed ? <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{lastUsedText(activity.lastUsed)}</span></TooltipTrigger><TooltipContent>{exactUtc(activity.lastUsed)}</TooltipContent></Tooltip> : <span>Never</span> : <span className="text-muted-foreground">Unavailable</span>}
          </div>
          <div><p className="mb-1 text-xs text-muted-foreground sm:hidden">Tokens (30 days)</p>
            {activityLoading ? <span className="text-muted-foreground">Loading…</span> : activity ? <><p>{compactTokens(activity.totals.inputTokens)} / {compactTokens(activity.totals.outputTokens)}</p><p className="text-xs text-muted-foreground">{activity.totals.requests.toLocaleString('en')} requests · {activityCredits(activity.totals.spend)}</p></> : <span className="text-muted-foreground">Unavailable</span>}
          </div>
        </div>}
        {apiKey.is_active && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onRename && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={t("Rename")} title={t("Rename")}><Pencil className="h-4 w-4" /></Button>
            )}
            {onRotate && !isChat && (
              <Button variant="ghost" size="icon" disabled={busy} onClick={() => onRotate(apiKey.id)} aria-label={t("Rotate")} title={t("Rotate")}><RefreshCw className="h-4 w-4" /></Button>
            )}
            {onRevoke && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={busy} aria-label={t("Revoke")} title={t("Revoke")}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("Revoke this key?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isChat
                        ? t("\"{name}\" stops working right away. If that browser opens the chat again, it makes a new chat key.", { name: apiKey.name })
                        : t("\"{name}\" stops working right away. This cannot be undone.", { name: apiKey.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRevoke(apiKey.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("Revoke")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
