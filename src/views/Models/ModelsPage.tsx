import { Navbar } from "@/components/Navbar";
import { Cpu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ModelRow } from "./components/ModelRow";
import { ConnectSection } from "./components/ConnectSection";

export const ModelsPage = () => {
  const { models, isLoading } = useCuratedModels(true);
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "portalen";


  const defaultModel = models.find((m) => m.is_default)?.model_name || models[0]?.model_name || "gpt-4o";

  return (
    <>
    <Navbar />
    <div className="container mx-auto px-4 pt-24 pb-10 max-w-3xl space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Cpu className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Modeller</h1>
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
    </>
  );
};
