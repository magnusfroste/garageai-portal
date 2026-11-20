import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { eventMailService } from "@/models/services/eventMailService";
import { setLanguage, t } from "@/i18n";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [out, setOut] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const meta = document.createElement("meta"); meta.name = "referrer"; meta.content = "no-referrer"; document.head.appendChild(meta);
    let alive = true;
    void eventMailService.unsubscribe(token, "status").then(result => { if (alive) { setOut(result.opted_out); setLanguage(result.language); } }).catch(e => { if (alive) setError(e instanceof Error ? e.message : "Mail operation failed"); });
    return () => { alive = false; meta.remove(); };
  }, [token]);
  const change = async (action: "unsubscribe" | "undo") => {
    setBusy(true); setError("");
    try { const result = await eventMailService.unsubscribe(token, action); setOut(result.opted_out); } catch { setError("Could not save mail preferences."); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-background text-foreground p-6 sm:p-12 space-y-6">
    <p className="font-semibold text-lg">GarageAI</p><h1 className="text-2xl font-semibold">{t(out ? "You are unsubscribed" : "Account mail")}</h1>
    {error ? <p role="alert" className="text-destructive">{t(error)}</p> : out === null ? <p>{t("Loading...")}</p> : <>
      <p className="text-muted-foreground">{t(out ? "You will no longer receive mail about your account and garages. Sign-in mail and receipts are unaffected." : "Stop mail about your account and garages? Sign-in mail and receipts are unaffected.")}</p>
      <Button disabled={busy} onClick={() => void change(out ? "undo" : "unsubscribe")}>{t(out ? "Undo" : "Unsubscribe")}</Button>
    </>}
  </main>;
}