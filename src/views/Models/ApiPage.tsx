import { Navbar } from "@/components/Navbar";
import { Terminal } from "lucide-react";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ConnectSection } from "./components/ConnectSection";
import { AgenticToolsSection } from "./components/AgenticToolsSection";
import { t } from "@/i18n";

export const ApiPage = () => {
  const { models } = useCuratedModels(true);
  const { settings } = useSiteSettings();


  const defaultModel =
    models.find((m) => m.is_default && m.garage_tier === "pool")?.model_name ||
    models.find((m) => m.garage_tier === "pool")?.model_name || "";
  const baseUrl = settings?.api_base_url || "https://llm.garageai.eu";

  return (
    <>
    <Navbar />
    <div className="container mx-auto px-4 pt-24 pb-10 max-w-3xl space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Terminal className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t("Documentation")}</h1>
        </div>
        <p className="text-muted-foreground mb-8 max-w-xl">
          {t("Everything you need to connect to the API and start building with agentic coding tools.")}
        </p>
      </div>

      <ConnectSection defaultModel={defaultModel} baseUrl={baseUrl} />
      <AgenticToolsSection baseUrl={baseUrl} />
    </div>
    </>
  );
};
