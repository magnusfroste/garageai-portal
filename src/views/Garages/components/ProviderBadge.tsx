import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";

/** Marks a garage that is a company provider (public endpoint) rather than a mesh node. */
export const ProviderBadge = ({ name }: { name: string | null | undefined }) =>
  name ? (
    <Badge variant="outline" className="ml-1.5 border-primary/40 text-[10px] text-primary" title={name}>
      {t("Provider")} · {name}
    </Badge>
  ) : null;
