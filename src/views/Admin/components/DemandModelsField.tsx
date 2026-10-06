import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { garageRepository, DemandModel } from "@/data/repositories/garageRepository";
import { t } from "@/i18n";

const parse = (text: string): DemandModel[] | null => {
  try {
    const v = JSON.parse(text);
    if (!Array.isArray(v)) return null;
    return v.every((d) => typeof d?.model === "string" && typeof d?.min_gb === "number") ? v : null;
  } catch { return null; }
};

/** Admin-maintained "demand list" shown in the Offer your GPU wizard. */
export const DemandModelsField = () => {
  const [text, setText] = useState("[]");
  const [saving, setSaving] = useState(false);
  useEffect(() => { garageRepository.demandModels().then((d) => setText(JSON.stringify(d, null, 2))).catch(() => undefined); }, []);
  const save = async () => {
    const value = parse(text);
    if (!value) { toast.error(t("Must be a JSON list of { model, min_gb, note }")); return; }
    setSaving(true);
    const { error } = await supabase.from("admin_settings").upsert({ key: "demand_models", value: value as never, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(t("Could not save")); else toast.success(t("Demand list saved"));
  };
  return (
    <div className="space-y-2">
      <Label htmlFor="demand">{t("Demand list (models requested by buyers)")}</Label>
      <Textarea id="demand" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-xs text-muted-foreground">{t("Shown in the Offer your GPU wizard. min_gb = memory needed.")}</p>
      <Button size="sm" variant="outline" onClick={save} disabled={saving}>{saving ? t("Saving...") : t("Save demand list")}</Button>
    </div>
  );
};
