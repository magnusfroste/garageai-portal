import { expect, test, mock } from "bun:test";
import { valid, lt, gt } from "semver";
mock.module("npm:semver@7.8.5", () => ({ valid, lt, gt }));
const module = await import("../../supabase/functions/_shared/bridgeVersions.ts");

test("newest published Bridge release includes prereleases and excludes drafts and other tags", () => {
  expect(module.newestBridgeRelease([
    {tag_name:"bridge-v0.4.5",draft:false,published_at:"2026-10-12T17:00:00Z"},
    {tag_name:"bridge-v0.4.6",draft:false,prerelease:true,published_at:"2026-10-12T19:41:28Z"},
    {tag_name:"bridge-v0.4.7",draft:true,published_at:"2026-10-12T20:00:00Z"},
    {tag_name:"v99.0.0",draft:false,published_at:"2026-10-12T21:00:00Z"},
  ])).toMatchObject({version:"v0.4.6",tag:"bridge-v0.4.6"});
});
test("Operations Center summary respects pin and legacy versions", () => {
  expect(module.bridgeVersionsSummary({version:"v0.4.6",pinned:"v0.4.5"},[
    {name:"old",agent:{version:"bridge-v0.4.0"}}, {name:"current",agent:{version:"v0.4.5"}}, {name:"legacy",agent:null},
  ])).toEqual({latest:"v0.4.6",pinned:"v0.4.5",stable:null,mode:"auto",garages:[{name:"old",canary:false,agent_state:null,version:"v0.4.0",outdated:true,auto:null,last_error:null},{name:"current",canary:false,agent_state:null,version:"v0.4.5",outdated:false,auto:null,last_error:null},{name:"legacy",canary:false,agent_state:null,version:null,outdated:false,auto:null,last_error:null}]});
});
test("latest is the newest release even when a stale pin exists; stable drives outdated", () => {
  const r = module.bridgeVersionsSummary({version:"v1.5.0",pinned:"v0.5.1"},[{name:"g",agent:{version:"v1.4.0"}}],{stable:"v1.4.0",mode:"auto"});
  expect([r.latest,r.pinned,r.stable,r.mode,r.garages[0].outdated]).toEqual(["v1.5.0","v0.5.1","v1.4.0","auto",false]);
  expect(module.bridgeVersionsSummary({version:"v1.5.0"},[{name:"g",agent:{version:"v1.4.0"}}]).garages[0].outdated).toBe(true);
});
