import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ConnectSection } from "./components/ConnectSection";
import { AgenticToolsSection } from "./components/AgenticToolsSection";

export const DashboardApiPage = () => {
  const { models } = useCuratedModels(true);
  const { settings } = useSiteSettings();

  const defaultModel =
    models.find((m) => m.is_default)?.model_name ||
    models[0]?.model_name ||
    "gpt-4o";
  const baseUrl = settings?.api_base_url || "https://your-lite-llm-proxy.example.com";

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Anslut & API</h1>
        <p className="text-muted-foreground text-sm">
          Everything you need to connect to the API and start building with agentic coding tools.
        </p>
      </div>

      <ConnectSection defaultModel={defaultModel} baseUrl={baseUrl} />
      <AgenticToolsSection baseUrl={baseUrl} />
    </div>
  );
};
