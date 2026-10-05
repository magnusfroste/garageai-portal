import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { ModelRow } from "./components/ModelRow";
import { ConnectSection } from "./components/ConnectSection";

export const ModelsPage = () => {
  const { models, isLoading } = useCuratedModels(true);
  const { settings, isLoading: settingsLoading } = useSiteSettings();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const siteName = settings?.site_name || "the portal";
  const isPublic = settings?.models_public ?? false;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (authChecked && !settingsLoading && !isPublic && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authChecked, settingsLoading, isPublic, isAuthenticated, navigate]);

  const defaultModel = models.find((m) => m.is_default)?.model_name || models[0]?.model_name || "gpt-4o";

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Cpu className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Models</h1>
        </div>
        <p className="text-muted-foreground mb-8 max-w-xl">
          These are the models currently available through {siteName}.
          Use any model ID below via the API — click the HuggingFace link for full documentation.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <p className="text-muted-foreground text-sm">No models available at the moment.</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <ModelRow key={m.id} model={m} />
            ))}
          </div>
        )}
      </div>

      <ConnectSection defaultModel={defaultModel} baseUrl={settings?.api_base_url || "https://your-lite-llm-proxy.example.com"} />
    </div>
  );
};
