import { expect, test } from "bun:test";
import { bridgeStatus, bridgeVersion, parseBridgeLatest, BRIDGE_UPDATE_COMMAND } from "../../../src/models/services/bridgeVersionService";
import { presentAdminBridge, matchesAdminGarage, presentAdminGarage } from "../../../src/models/services/adminGaragePresentation";
import type { Garage } from "../../../src/views/Admin/hooks/useGarages";

test("normalizes heartbeat versions and compares semver numerically", () => {
  expect(bridgeVersion("bridge-v0.4.0")).toBe("v0.4.0");
  expect(bridgeStatus("bridge-v0.4.9", parseBridgeLatest({version:"v0.4.10"})).outdated).toBe(true);
  expect(bridgeStatus("v0.10.0", parseBridgeLatest({version:"v0.4.6"})).outdated).toBe(false);
});
test("only older valid agent versions show updates", () => {
  const latest = parseBridgeLatest({version:"v0.4.6"});
  expect(bridgeStatus("bridge-v0.4.0",latest).outdated).toBe(true);
  for (const v of [null,undefined,"script 2026-10-09","", "v0.4.6","v0.4.7"]) expect(bridgeStatus(v,latest).outdated).toBe(false);
});
test("admin pin wins over discovered release", () => {
  const latest = parseBridgeLatest({version:"v0.4.6",pinned:"v0.4.5"});
  expect(bridgeStatus("v0.4.5", latest)).toEqual({version:"v0.4.5",latest:"v0.4.5",outdated:false});
  expect(bridgeStatus("v0.4.0", latest).outdated).toBe(true);
});
test("semver prereleases are compared correctly", () => {
  expect(bridgeStatus("v0.4.6-rc.1", parseBridgeLatest({version:"v0.4.6-rc.2"})).outdated).toBe(true);
});
test("update installs without connecting again", () => {
  expect(BRIDGE_UPDATE_COMMAND).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh");
});
test("admin outdated filter uses the shared version rule", () => {
  const g = { name:"old", agent:{version:"bridge-v0.4.0"} } as Garage;
  const latest = parseBridgeLatest({version:"v0.4.6"});
  const view = {...presentAdminGarage(g,[]),...presentAdminBridge(g,latest)};
  expect(matchesAdminGarage(g,view,"","outdated","all")).toBe(true);
  expect(matchesAdminGarage(g,{...view,...presentAdminBridge({...g,agent:null},latest)},"","outdated","all")).toBe(false);
});