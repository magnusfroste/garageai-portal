import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminSettings {
  default_user_budget_usd: number;
}

export const AdminSettingsPanel = () => {
  const [settings, setSettings] = useState<AdminSettings>({
    default_user_budget_usd: 25,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .eq("key", "default_user_budget_usd");

      if (error) throw error;

      if (data && data.length > 0) {
        setSettings({
          default_user_budget_usd: Number(data[0].value ?? 25),
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({ value: settings.default_user_budget_usd as never, updated_at: new Date().toISOString() })
        .eq("key", "default_user_budget_usd");
      if (error) throw error;
      toast.success("Settings saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Default settings
        </CardTitle>
        <CardDescription>
          These values apply to new users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="budget">Starting budget (USD)</Label>
          <Input
            id="budget"
            type="number"
            min={0}
            step={5}
            value={settings.default_user_budget_usd}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                default_user_budget_usd: Number(e.target.value),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            LiteLLM user max_budget at sign-up
          </p>
        </div>

        <PlatformFeeField />


        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
};
