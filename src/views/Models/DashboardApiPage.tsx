import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ConnectSection } from "./components/ConnectSection";
import { AgenticToolsSection } from "./components/AgenticToolsSection";
import { t } from "@/i18n";

export const DashboardApiPage = () => {
  const { models } = useCuratedModels(true);
  const { settings } = useSiteSettings();

  const defaultModel =
    models.find((m) => m.is_default && m.garage_tier === "pool")?.model_name ||
    models.find((m) => m.garage_tier === "pool")?.model_name || "";
  const baseUrl = settings?.api_base_url || "https://llm.garageai.eu";

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">{t("Connect & API")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("Everything you need to connect to the API and start building with agentic coding tools.")}
        </p>
      </div>

      <ConnectSection defaultModel={defaultModel} baseUrl={baseUrl} />
      <AgenticToolsSection baseUrl={baseUrl} />
    </div>
  );
};
