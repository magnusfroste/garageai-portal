import { Building2, Clock3, Coins, HeartPulse, MapPin, Network, Server, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GarageHealthIndicators, GarageModelList } from "@/views/Garages/components/GarageHealth";
import { ToolsTestBadge } from "@/views/Garages/components/GarageShared";
import { GarageCountryCell } from "../GarageCountryEditor";
import { GarageStatusCell } from "./GarageStatusCell";
import type { AdminGarageRow } from "./types";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { t } from "@/i18n";

const Section = ({ icon: Icon, title, children }: { icon: typeof Server; title: string; children: React.ReactNode }) => (
  <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h3>{children}</section>
);
const Field = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="min-w-0"><dt className="admin-meta">{label}</dt><dd className="mt-0.5 break-words text-sm">{value || "—"}</dd></div>;
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const usd = (value: number) => `$${value.toFixed(value < 1 ? 4 : 2)}`;

export const GarageDetailSheet = ({ row, open, onOpenChange, pending, onToggle, onAlias, onSaved }: {
  row: AdminGarageRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: string | null;
  onToggle: (garage: string, model: string, offered: boolean) => Promise<unknown>;
  onAlias: (garage: string, model: string, canonical: string, isPrivate: boolean) => Promise<unknown>;
  onSaved: () => void;
}) => {
  if (!row) return null;
  const { garage } = row;
  const provider = garage.connection_type === "endpoint";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="mt-1 rounded-md border bg-muted/40 p-2">{provider ? <Building2 className="h-4 w-4" /> : <Network className="h-4 w-4" />}</div>
            <div className="min-w-0 flex-1"><SheetTitle className="truncate font-mono">{garage.name}</SheetTitle><SheetDescription>{garage.display_name || t(provider ? "Provider" : "Garage")}</SheetDescription></div>
            <GarageStatusCell view={row.view} />
          </div>
        </SheetHeader>
        <div className="space-y-6 px-5 py-5">
          <Section icon={HeartPulse} title={t("Health")}>
            <GarageHealthIndicators garage={garage} models={row.models} />
            <dl className="grid grid-cols-2 gap-3"><Field label={t("Last gateway check")} value={date(garage.last_gateway_check_at)} /><Field label={t("Last heartbeat")} value={provider ? t("Not applicable") : date(garage.last_heartbeat_at)} /></dl>
          </Section>
          <Separator />
          <Section icon={Server} title={t("Models")}>
            {row.models.length ? <GarageModelList garageName={garage.name} models={row.models} pending={pending} onToggle={onToggle} onAlias={provider ? onAlias : undefined} offline={garage.runtime_ok === false || garage.mesh_connected === false || garage.status === "offline" || garage.disabled} /> : <p className="text-sm text-muted-foreground">{t("No models reported.")}</p>}
            {row.models.map((model) => { const test = row.tests.get(`${garage.id}::${model.model}`); return test ? <div key={model.model} className="flex flex-wrap items-center gap-2 text-xs"><Badge variant={test.passed ? "success" : "danger"}>{test.passed ? t("Passed") : t("Failed")}</Badge><span className="font-mono">{model.canonical_model || model.model}</span>{test.tokens_per_second != null && <span className="tabular-nums text-muted-foreground">{test.tokens_per_second} tok/s</span>}{test.ttft_ms != null && <span className="tabular-nums text-muted-foreground">TTFT {test.ttft_ms} ms</span>}<ToolsTestBadge test={test} runtime={garage.runtime} /></div> : null; })}
          </Section>
          <Separator />
          <Section icon={Network} title={t("Connection")}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Field label={t("Type")} value={t(provider ? "Provider endpoint" : "Mesh garage")} /><Field label={t(provider ? "Endpoint host" : "Mesh IP")} value={provider ? (garage.endpoint_url ? new URL(garage.endpoint_url).host : "—") : garage.mesh_ip} /><Field label={t("API host override")} value={garage.api_host} /><Field label={t("Runtime")} value={garage.runtime ? runtimeLabel(garage.runtime) : "—"} /><Field label={t("Port")} value={garage.port} /><Field label={t("Registered")} value={date(garage.last_registered_at)} /></dl>
          </Section>
          <Separator />
          <Section icon={UserRound} title={t("Owner & terms")}><dl className="grid grid-cols-2 gap-3"><Field label={t("Operator")} value={row.operatorEmail || t("No owner")} /><Field label={t("Terms")} value={garage.terms_accepted_at ? `${garage.terms_version || "—"} · ${date(garage.terms_accepted_at)}` : t("Missing")} /></dl></Section>
          <Separator />
          <Section icon={MapPin} title={t("Location")}><GarageCountryCell garage={garage} changedRecently={row.changedRecently} onSaved={onSaved} /><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Field label={t("Measured")} value={garage.measured_country} /><Field label={t("Declared")} value={garage.declared_country} /><Field label={t("Admin override")} value={garage.country_override} /><Field label={t("Public display")} value={garage.location_display} /></dl></Section>
          <Separator />
          <Section icon={Coins} title={t("Pricing")}><dl className="grid grid-cols-2 gap-3"><Field label={t("Pool · tokens in")} value={`${usd(garage.pool_input_cost_per_million ?? 0)} / 1M`} /><Field label={t("Pool · tokens out")} value={`${usd(garage.pool_output_cost_per_million ?? 0)} / 1M`} /><Field label={t("Specific garage · tokens in")} value={`${usd(garage.dedicated_input_cost_per_million ?? 0)} / 1M`} /><Field label={t("Specific garage · tokens out")} value={`${usd(garage.dedicated_output_cost_per_million ?? 0)} / 1M`} /></dl></Section>
          <Separator />
          <Section icon={Clock3} title={t("Revenue this month")}>
            {row.revenue ? <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Field label={t("Requests")} value={row.revenue.requests.toLocaleString()} /><Field label={t("Failures")} value={row.revenue.failures.toLocaleString()} /><Field label={t("Tokens in / out")} value={`${row.revenue.promptTokens.toLocaleString()} / ${row.revenue.completionTokens.toLocaleString()}`} /><Field label={t("Revenue") } value={usd(row.revenue.revenue)} /><Field label={t("Payable") } value={usd(row.revenue.payable)} /></dl> : <p className="text-sm text-muted-foreground">{t("No usage this month.")}</p>}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};