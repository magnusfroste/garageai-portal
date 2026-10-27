import { describe, expect, it } from "bun:test";
import { LINKS } from "@/components/Navbar";

describe("public top navigation", () => {
  it("is Models, Garages, Documentation — no Pricing", () => {
    expect(LINKS.map((l) => l.label)).toEqual(["Models", "Garages", "Documentation"]);
  });

  it("does not link to /pricing", () => {
    expect(LINKS.map((l) => l.to)).not.toContain("/pricing");
  });
});
