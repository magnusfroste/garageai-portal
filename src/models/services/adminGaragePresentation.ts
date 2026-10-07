import type { GarageModelRow } from "@/data/repositories/garageRepository";
import type { Garage } from "@/views/Admin/hooks/useGarages";

export type AdminGarageStatus = "disabled" | "paused" | "offline" | "degraded" | "live";
export type AdminGarageFilter = "all" | "attention" | "live" | "paused" | "disabled";
export type AdminGarageTypeFilter = "all" | "garage" | "provider";

export interface AdminGaragePresentation {
  status: AdminGarageStatus;
  label: string;
  reason: string | null;
  attention: boolean;
  severity: number;
  offered: number;
  live: number;
  lastSeen: string | null;
}

const newest = (...values: Array<string | null | undefined>) => {
  const valid = values.filter((v): v is string => Boolean(v));
  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
};

export const presentAdminGarage = (garage: Garage, models: GarageModelRow[], now = Date.now()): AdminGaragePresentation => {
  const offeredRows = models.filter((model) => model.offered);
  const live = offeredRows.filter((model) => model.installed && model.status === "live").length;
  const lastSeen = garage.connection_type === "endpoint"
    ? garage.last_gateway_check_at ?? null
    : newest(garage.last_heartbeat_at, garage.last_gateway_check_at);
  const stale = !lastSeen || now - new Date(lastSeen).getTime() > 15 * 60_000;
  const failedModels = offeredRows.some((model) => model.status === "failed");

  if (garage.disabled) return { status: "disabled", label: "Disabled", reason: "Disabled by admin", attention: false, severity: 4, offered: offeredRows.length, live, lastSeen };
  if (garage.paused_at) return { status: "paused", label: "Paused", reason: garage.paused_reason || null, attention: false, severity: 3, offered: offeredRows.length, live, lastSeen };
  if (garage.mesh_connected === false) return { status: "offline", label: "Offline", reason: "Tunnel disconnected", attention: true, severity: 0, offered: offeredRows.length, live: 0, lastSeen };
  if (garage.runtime_ok === false) return { status: "offline", label: "Offline", reason: garage.runtime_error || "Runtime unavailable", attention: true, severity: 0, offered: offeredRows.length, live: 0, lastSeen };
  if (garage.status === "offline") return { status: "offline", label: "Offline", reason: "Garage is offline", attention: offeredRows.length > 0, severity: 0, offered: offeredRows.length, live: 0, lastSeen };
  if (!garage.terms_accepted_at) return { status: "degraded", label: "Degraded", reason: "Operator terms missing", attention: true, severity: 1, offered: offeredRows.length, live, lastSeen };
  if (failedModels) return { status: "degraded", label: "Degraded", reason: "An offered model failed testing", attention: true, severity: 1, offered: offeredRows.length, live, lastSeen };
  if (stale) return { status: "degraded", label: "Degraded", reason: "No signal for more than 15 min", attention: true, severity: 2, offered: offeredRows.length, live, lastSeen };
  return { status: "live", label: "Live", reason: null, attention: false, severity: 2, offered: offeredRows.length, live, lastSeen };
};

export const matchesAdminGarage = (garage: Garage, view: AdminGaragePresentation, search: string, status: AdminGarageFilter, type: AdminGarageTypeFilter) => {
  const query = search.trim().toLowerCase();
  const matchesSearch = !query || [garage.name, garage.display_name, garage.runtime, garage.endpoint_url].some((value) => value?.toLowerCase().includes(query));
  const matchesStatus = status === "all" || (status === "attention" ? view.attention : view.status === status);
  const matchesType = type === "all" || (type === "provider" ? garage.connection_type === "endpoint" : garage.connection_type !== "endpoint");
  return matchesSearch && matchesStatus && matchesType;
};

export const sortAdminGarages = <T extends { garage: Garage; view: AdminGaragePresentation }>(rows: T[]) => [...rows].sort((a, b) => {
  if (a.view.attention !== b.view.attention) return a.view.attention ? -1 : 1;
  if (a.view.status === "live" && b.view.status !== "live") return -1;
  if (b.view.status === "live" && a.view.status !== "live") return 1;
  if (a.view.severity !== b.view.severity) return a.view.severity - b.view.severity;
  const time = new Date(b.view.lastSeen ?? 0).getTime() - new Date(a.view.lastSeen ?? 0).getTime();
  return time || a.garage.name.localeCompare(b.garage.name);
});