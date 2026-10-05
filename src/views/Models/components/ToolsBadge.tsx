import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { t } from "@/i18n";
/** Shown on models where at least one garage passed the tool-calling probe. */
export const ToolsBadge = () => (
  <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 shrink-0" title={t("Supports tool calling")}>
    <Wrench className="h-3 w-3" /> Verktyg
  </Badge>
);
