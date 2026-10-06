import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/i18n";
export const HowWeMeasure = () => <Popover><PopoverTrigger asChild><Button variant="link" size="sm" className="px-0">{t("How we measure")}</Button></PopoverTrigger><PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-2 text-xs" align="start">
  <h3 className="font-semibold text-sm">{t("How we measure")}</h3>
  <p>{t("Availability is the share of scheduled checks that find the garage ready to serve. Success rate is the share of real requests that succeed.")}</p>
  <p>{t("Speed is the median tokens per second. Slow responses lower the grade, but do not delist a garage.")}</p>
  <p>{t("The score weights availability 50%, success rate 30% and speed 20%. A grade needs at least 7 days of measurements; until then it is New.")}</p>
  <p>{t("A disconnected tunnel, unreachable runtime or no healthy offered models counts as an outage. Disabled garages and fully paused models are excluded from new checks; earlier outages remain in the history.")}</p>
</PopoverContent></Popover>;