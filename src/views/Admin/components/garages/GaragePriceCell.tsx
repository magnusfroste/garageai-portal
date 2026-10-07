import type { Garage } from "../../hooks/useGarages";
import { t } from "@/i18n";

const price = (value?: number) => `$${Number(value ?? 0).toFixed(2)}`;

export const GaragePriceCell = ({ garage }: { garage: Garage }) => (
  <div className="space-y-1 text-xs tabular-nums">
    <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("Pool")}</span><span>{price(garage.pool_input_cost_per_million)} / {price(garage.pool_output_cost_per_million)}</span></div>
    <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t("Direct")}</span><span>{price(garage.dedicated_input_cost_per_million)} / {price(garage.dedicated_output_cost_per_million)}</span></div>
  </div>
);