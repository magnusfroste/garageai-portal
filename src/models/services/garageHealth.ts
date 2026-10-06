import type { GarageModelRow } from "@/data/repositories/garageRepository";
import { runtimeLabel } from "./garageRuntime";

export type Indicator = "ok" | "fail" | "unknown";

export interface GarageHealthInput {
  status: string;
  disabled: boolean;
  runtime: string | null;
  port: number | null;
  connection_type?: string | null;
  mesh_connected?: boolean | null;
  runtime_ok?: boolean | null;
  runtime_error?: string | null;
  last_gateway_check_at?: string | null;
}

export interface GarageHealth {
  tunnel: Indicator;
  runtime: Indicator;
  port: number | null;
  offered: number;
  live: number;
  /** English source string + params, rendered through t(). */
  reason: { text: string; params?: Record<string, string | number> } | null;
}

export const EMBEDDING_RE = /embed|bge-|bge:|e5-|minilm|rerank|colbert|gte-/i;
export const isEmbeddingModel = (model: string) => EMBEDDING_RE.test(model);

const tri = (v: boolean | null | undefined): Indicator => (v === true ? "ok" : v === false ? "fail" : "unknown");

/** Turns gateway L1/L2 results + model inventory into the three indicators and one reason line. */
export const garageHealth = (g: GarageHealthInput, models: GarageModelRow[]): GarageHealth => {
  const isEndpoint = g.connection_type === "endpoint";
  const tunnel = isEndpoint ? "unknown" : tri(g.mesh_connected);
  const runtime = tri(g.runtime_ok);
  const offeredRows = models.filter((m) => m.offered && m.installed);
  const healthy = runtime !== "fail" && tunnel !== "fail" && !g.disabled;
  const live = healthy ? offeredRows.filter((m) => m.status === "live").length : 0;
  let reason: GarageHealth["reason"] = null;
  if (g.disabled) reason = { text: "The garage has been disabled by the platform." };
  else if (tunnel === "fail") reason = { text: "Tunnel: NetBird is not connected" };
  else if (runtime === "fail") reason = {
    text: "Runtime: nothing answers on port {port} — start {runtime} (see Troubleshooting)",
    params: { port: g.port ?? "?", runtime: g.runtime ? runtimeLabel(g.runtime) : "the runtime" },
  };
  else if (g.status === "offline") reason = { text: "Garage is offline" };
  else if (models.length > 0 && offeredRows.length === 0) reason = { text: "No models offered — turn on Offer for a model below" };
  else if (offeredRows.length > 0 && offeredRows.every((m) => m.status === "failed")) reason = { text: "All offered models failed the acceptance test" };
  else if (g.status === "offline" && !g.last_gateway_check_at) reason = { text: "No recent heartbeat — the machine may be asleep or the token revoked (get a new command)" };
  return { tunnel, runtime, port: g.port, offered: offeredRows.length, live, reason };
};
