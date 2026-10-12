import { expect, test, mock } from "bun:test";
import { valid, lt } from "semver";
mock.module("npm:semver@7.8.5", () => ({ valid, lt }));
const module = await import("../../supabase/functions/_shared/bridgeVersions.ts");

test("newest published Bridge release includes prereleases and excludes drafts and other tags", () => {
  expect(module.newestBridgeRelease([
    {tag_name:"bridge-v0.4.5",draft:false,published_at:"2026-10-12T17:00:00Z"},
    {tag_name:"bridge-v0.4.6",draft:false,prerelease:true,published_at:"2026-10-12T19:41:28Z"},
    {tag_name:"bridge-v0.4.7",draft:true,published_at:"2026-10-12T20:00:00Z"},
    {tag_name:"v99.0.0",draft:false,published_at:"2026-10-12T21:00:00Z"},
  ])).toEqual({version:"v0.4.6",tag:"bridge-v0.4.6"});
});
test("Operations Center summary respects pin and legacy versions", () => {
  expect(module.bridgeVersionsSummary({version:"v0.4.6",pinned:"v0.4.5"},[
    {name:"old",agent:{version:"bridge-v0.4.0"}}, {name:"current",agent:{version:"v0.4.5"}}, {name:"legacy",agent:null},
  ])).toEqual({latest:"v0.4.5",pinned:"v0.4.5",garages:[{name:"old",version:"v0.4.0",outdated:true},{name:"current",version:"v0.4.5",outdated:false},{name:"legacy",version:null,outdated:false}]});
});