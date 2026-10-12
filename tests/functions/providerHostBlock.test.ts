import { expect, test } from "bun:test";
import { matchesBlockedHost, validateEndpointUrl } from "../../supabase/functions/_shared/endpointUrl";
import { GARAGE_DOMAINS, GARAGE_EXTRA_HOSTS, isGarageHost } from "../../supabase/functions/_shared/garageHosts";

// create-provider blocks GarageAI's own hosts so a provider endpoint can never
// point back at our gateway and loop. api.garageai.eu is the public API name.
const blocked = [...GARAGE_DOMAINS];

test("provider URL on api.garageai.eu is rejected", async () => {
  await expect(validateEndpointUrl("https://api.garageai.eu/v1", { blockedDomains: blocked })).rejects.toThrow("must not point at this gateway");
});

test("every host under garageai.eu is rejected", async () => {
  for (const url of ["https://llm.garageai.eu/v1", "https://app.garageai.eu/v1", "https://garageai.eu/v1", "https://anything.deep.garageai.eu/v1"]) {
    await expect(validateEndpointUrl(url, { blockedDomains: blocked })).rejects.toThrow("must not point at this gateway");
  }
});

test("host matching is exact-or-subdomain, never substring", () => {
  expect(matchesBlockedHost("api.garageai.eu", [], ["garageai.eu"])).toBe(true);
  expect(matchesBlockedHost("garageai.eu", [], ["garageai.eu"])).toBe(true);
  expect(matchesBlockedHost("notgarageai.eu", [], ["garageai.eu"])).toBe(false);
  expect(matchesBlockedHost("garageai.eu.evil.example", [], ["garageai.eu"])).toBe(false);
  expect(matchesBlockedHost("portal.liteit.se", [...GARAGE_EXTRA_HOSTS], blocked)).toBe(true);
  expect(isGarageHost("API.GarageAI.EU")).toBe(true);
  expect(isGarageHost("liteit.se")).toBe(false);
});
