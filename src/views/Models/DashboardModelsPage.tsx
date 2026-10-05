import { Skeleton } from "@/components/ui/skeleton";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { ModelRow } from "./components/ModelRow";

import { t } from "@/i18n";
export const DashboardModelsPage = () => {
  const { models, isLoading } = useCuratedModels(true);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">{t("Models")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("Available models. See")} <a href="/dashboard/api" className="text-primary hover:underline">{t("Connect & API")}</a> {t("to get started.")}
        </p>
      </div>

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
  );
};
