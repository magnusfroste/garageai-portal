import { describe, expect, test } from "bun:test";
import type { GarageModelRow } from "../../data/repositories/garageRepository";
import type { Garage } from "../../views/Admin/hooks/useGarages";
import {
  matchesAdminGarage,
  presentAdminGarage,
  sortAdminGarages,
} from "./adminGaragePresentation";

const NOW = Date.parse("2026-10-07T23:00:00Z");

const garage = (overrides: Partial<Garage> = {}): Garage => ({
  id: "garage-1",
  name: "mesh-one",
  display_name: "Mesh One",
  operator_id: null,
  api_host: null,
  runtime: "ollama",
  port: 11434,
  models: [],
  mesh_ip: null,
  netbird_peer_id: null,
  status: "online",
  disabled: false,
  last_registered_at: "2026-10-07T20:00:00Z",
  last_heartbeat_at: "2026-10-07T22:58:00Z",
  last_gateway_check_at: "2026-10-07T22:57:00Z",
  created_at: "2026-10-01T00:00:00Z",
  connection_type: "mesh",
  mesh_connected: true,
  runtime_ok: true,
  paused_at: null,
  terms_accepted_at: "2026-10-01T00:00:00Z",
  ...overrides,
});

const model = (overrides: Partial<GarageModelRow> = {}): GarageModelRow => ({
  garage_id: "garage-1",
  model: "runtime-model",
  canonical_model: "creator/model",
  canonical_source: "auto",
  private: false,
  installed: true,
  offered: true,
  status: "live",
  updated_at: "2026-10-07T22:58:00Z",
  ...overrides,
});

describe("presentAdminGarage", () => {
  test("applies Disabled → Paused → Offline → Degraded → Live precedence", () => {
    expect(presentAdminGarage(garage({ disabled: true, paused_at: "2026-10-07T21:00:00Z", runtime_ok: false }), [], NOW).status).toBe("disabled");
    expect(presentAdminGarage(garage({ paused_at: "2026-10-07T21:00:00Z", runtime_ok: false }), [], NOW).status).toBe("paused");
    expect(presentAdminGarage(garage({ runtime_ok: false, terms_accepted_at: null }), [], NOW).status).toBe("offline");
    expect(presentAdminGarage(garage({ terms_accepted_at: null }), [], NOW).status).toBe("degraded");
    expect(presentAdminGarage(garage(), [model()], NOW).status).toBe("live");
  });

  test("marks failed connectivity, tests, missing terms, and stale signals for attention", () => {
    expect(presentAdminGarage(garage({ mesh_connected: false }), [], NOW).attention).toBe(true);
    expect(presentAdminGarage(garage({ runtime_ok: false, runtime_error: "runtime 401" }), [], NOW).reason).toBe("runtime 401");
    expect(presentAdminGarage(garage(), [model({ status: "failed" })], NOW).attention).toBe(true);
    expect(presentAdminGarage(garage({ terms_accepted_at: null }), [], NOW).attention).toBe(true);
    expect(presentAdminGarage(garage({ last_heartbeat_at: "2026-10-07T22:30:00Z", last_gateway_check_at: null }), [], NOW).attention).toBe(true);
  });

  test("counts every offered model but only installed live models as live", () => {
    const view = presentAdminGarage(garage(), [model(), model({ model: "missing", installed: false })], NOW);
    expect({ offered: view.offered, live: view.live }).toEqual({ offered: 2, live: 1 });
  });

  test("uses gateway checks for providers and newest gateway/heartbeat signal for mesh", () => {
    expect(presentAdminGarage(garage(), [], NOW).lastSeen).toBe("2026-10-07T22:58:00Z");
    expect(presentAdminGarage(garage({ connection_type: "endpoint", last_heartbeat_at: "2026-10-07T22:59:00Z" }), [], NOW).lastSeen).toBe("2026-10-07T22:57:00Z");
  });
});

test("filters search, attention, and garage/provider type independently", () => {
  const mesh = garage();
  const view = presentAdminGarage(mesh, [model({ status: "failed" })], NOW);
  expect(matchesAdminGarage(mesh, view, "mesh one", "attention", "garage")).toBe(true);
  expect(matchesAdminGarage(mesh, view, "mesh one", "attention", "provider")).toBe(false);
});

test("sorts attention first, then live, with stable name fallback", () => {
  const attention = garage({ id: "a", name: "attention", runtime_ok: false });
  const liveA = garage({ id: "b", name: "alpha" });
  const liveB = garage({ id: "c", name: "beta" });
  const rows = [liveB, liveA, attention].map((item) => ({ garage: item, view: presentAdminGarage(item, [model()], NOW) }));
  expect(sortAdminGarages(rows).map((row) => row.garage.name)).toEqual(["attention", "alpha", "beta"]);
});