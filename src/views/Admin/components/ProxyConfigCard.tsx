import { useState, useEffect } from "react";
import { Server, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Plus, Save, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { toast } from "sonner";

import { t } from "@/i18n";
interface ProxyStatus {
  has_key: boolean;
  key_prefix: string | null;
  connected: boolean;
  api_url?: string;
  litellm_version?: string;
  model_count?: number;
  health_response?: string;
  error?: string;
}

export const ProxyConfigCard = () => {
  const { rawSettings: settings, save, isSaving } = useSiteSettings();
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [editingNetbird, setEditingNetbird] = useState(false);
  const [netbirdDraft, setNetbirdDraft] = useState("");

  const [searxDraft, setSearxDraft] = useState("");
  useEffect(() => {
    setSearxDraft(settings?.searxng_url || "https://search.liteit.se");
  }, [settings?.searxng_url]);
  const handleSaveSearx = () => {
    if (!settings) return;
    save({ ...settings, searxng_url: searxDraft.trim().replace(/\/+$/, "") });
    toast.success(t("Search server saved"));
  };

  useEffect(() => {
    if (settings?.netbird_api_url) setNetbirdDraft(settings.netbird_api_url);
  }, [settings?.netbird_api_url]);

  const handleSaveNetbird = () => {
    if (!settings) return;
    save({ ...settings, netbird_api_url: netbirdDraft.trim().replace(/\/+$/, "") });
    setEditingNetbird(false);
  };

  useEffect(() => {
    if (settings?.api_base_url) {
      setUrlDraft(settings.api_base_url);
    }
  }, [settings?.api_base_url]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-proxy-status");
      if (error) throw error;
      setStatus(data as ProxyStatus);
    } catch (err) {
      console.error("Proxy check error:", err);
      setStatus({ has_key: false, key_prefix: null, connected: false, error: "Could not run the check" });
    } finally {
      setChecking(false);
    }
  };

  const handleSaveUrl = () => {
    if (!settings) return;
    const trimmed = urlDraft.replace(/\/+$/, "");
    save({ ...settings, api_base_url: trimmed });
    setEditingUrl(false);
    setStatus(null); // Reset so user re-checks with new URL
    toast.success("API URL saved — click 'Check' to test");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          LLM Proxy configuration
        </CardTitle>
        <CardDescription>
          Connection to the LiteLLM proxy. Support for more proxies coming soon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Base URL - always visible */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">API Base URL</Label>
          {editingUrl ? (
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://api.example.com"
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleSaveUrl} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingUrl(false); setUrlDraft(settings?.api_base_url || ""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                {settings?.api_base_url || "Not configured"}
              </code>
              <Button size="sm" variant="ghost" onClick={() => setEditingUrl(true)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("Search server (SearXNG) URL")}</Label>
          <div className="flex gap-2">
            <Input value={searxDraft} onChange={(e) => setSearxDraft(e.target.value)} placeholder="https://search.liteit.se" className="font-mono text-sm" />
            <Button size="sm" onClick={handleSaveSearx} disabled={isSaving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {t("Save")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("Used by web search in the chat. An optional authentication header is set via the secrets SEARXNG_HEADER_NAME / SEARXNG_HEADER_VALUE.")}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">NetBird API URL</Label>
          {editingNetbird ? (
            <div className="flex gap-2">
              <Input
                value={netbirdDraft}
                onChange={(e) => setNetbirdDraft(e.target.value)}
                placeholder="https://netbird.example.com/api"
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleSaveNetbird} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingNetbird(false); setNetbirdDraft(settings?.netbird_api_url || ""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                {settings?.netbird_api_url || "Not configured"}
              </code>
              <Button size="sm" variant="ghost" onClick={() => setEditingNetbird(true)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {!status && !checking ? (
          <Button onClick={checkStatus} variant="outline" className="w-full md:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check proxy connection
          </Button>
        ) : checking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Checking...
          </div>
        ) : status && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">LiteLLM</Badge>
              <span className="text-xs text-muted-foreground">Active proxy</span>
            </div>

            {/* Key status */}
            <div className="flex items-center gap-3 flex-wrap">
              {status.has_key ? (
                <Badge variant="default" className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Master Key configured
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  Master Key missing
                </Badge>
              )}
              {status.key_prefix && (
                <span className="text-xs text-muted-foreground font-mono">
                  Key: {status.key_prefix}
                </span>
              )}
            </div>

            {/* Connection status */}
            {status.has_key && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Connection</p>
                    <p className={status.connected ? "text-emerald-500 font-medium" : "text-destructive font-medium"}>
                      {status.connected ? "Connected ✓" : "Could not reach proxy"}
                    </p>
                  </div>
                  {status.litellm_version && (
                    <div>
                      <p className="text-muted-foreground text-xs">LiteLLM Version</p>
                      <p className="font-medium">v{status.litellm_version}</p>
                    </div>
                  )}
                  {status.model_count !== undefined && (
                    <div>
                      <p className="text-muted-foreground text-xs">Models</p>
                      <p className="font-medium">{status.model_count} active</p>
                    </div>
                  )}
                  {status.health_response && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Health response</p>
                      <p className="font-mono text-xs text-muted-foreground truncate">{status.health_response}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {status.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{status.error}</p>
                </div>
              </div>
            )}

            {!status.has_key && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-destructive">LITELLM_MASTER_KEY is not configured</p>
                    <p className="text-muted-foreground">
                      The portal needs a master key to communicate with your LiteLLM proxy.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Find your LiteLLM master key in your <code className="text-xs bg-muted px-1 py-0.5 rounded">config.yaml</code></li>
                      <li>Go to <strong>Lovable Cloud → Secrets</strong></li>
                      <li>Add a secret named <code className="text-xs bg-muted px-1 py-0.5 rounded">LITELLM_MASTER_KEY</code></li>
                      <li>Paste your master key as the value</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button onClick={checkStatus} disabled={checking} variant="outline" size="sm">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
                Check again
              </Button>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Plus className="w-3.5 h-3.5" />
                <span>Support for more LLM proxies (OpenRouter, custom OpenAI-compatible) coming in future versions.</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
