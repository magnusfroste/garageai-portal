import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/i18n";

/** Marks a provider-private model (own finetune): dedicated tier only, never pooled. */
export const ProviderModelBadge = () => (
  <TooltipProvider><Tooltip><TooltipTrigger asChild>
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0" tabIndex={0}>{t("Provider model")}</Badge>
  </TooltipTrigger><TooltipContent className="max-w-xs">{t("A model the provider runs under its own name. Not pooled with other garages.")}</TooltipContent></Tooltip></TooltipProvider>
);
