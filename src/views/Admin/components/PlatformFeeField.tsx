import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { toast } from "sonner";

export const PlatformFeeField = () => {
  const { rawSettings: settings, save, isSaving } = useSiteSettings();
  const [draft, setDraft] = useState("0");

  useEffect(() => {
    if (settings) setDraft(String(settings.platform_fee_percent ?? 0));
  }, [settings?.platform_fee_percent]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 100;

  const handleSave = () => {
    if (!settings) return;
    if (!valid) {
      toast.error("Platform fee must be between 0 and 100");
      return;
    }
    save({ ...settings, platform_fee_percent: value });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="platform-fee">Platform fee (%)</Label>
      <div className="flex gap-2">
        <Input
          id="platform-fee"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={!valid}
          className="max-w-[160px]"
        />
        <Button variant="outline" onClick={handleSave} disabled={isSaving || !valid || !settings}>
          <Save className="w-4 h-4 mr-2" />
          Save fee
        </Button>
      </div>
      {!valid && <p className="text-xs text-destructive">Enter a value between 0 and 100.</p>}
      <p className="text-xs text-muted-foreground">
        Share of usage revenue kept by the platform. The operator receives the rest. Applied at the time of usage.
      </p>
    </div>
  );
};
