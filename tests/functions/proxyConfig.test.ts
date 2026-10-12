import { describe, it, expect } from "bun:test";
import { isPublicGatewayHost } from "../../supabase/functions/_shared/proxyConfig";

describe("internal gateway host guard", () => {
  it("rejects the public API host for internal admin calls", () => {
    expect(isPublicGatewayHost("https://api.garageai.eu")).toBe(true);
    expect(isPublicGatewayHost("https://API.garageai.eu/v1/")).toBe(true);
  });
  it("allows the internal host", () => {
    expect(isPublicGatewayHost("https://llm.garageai.eu")).toBe(false);
  });
});
