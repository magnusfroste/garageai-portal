import { describe, expect, test } from "bun:test";
import { buildGarageCommand, type GarageCredentials } from "@/models/services/garageCommand";

const credentials: GarageCredentials = { garage: { id: "g", name: "garage-m2" }, setup_key: "setup-test", register_token: "register-test", register_url: "https://example.test/register-node", management_url: "https://mesh.example.test" };

describe("Bridge connection rules", () => {
  test("secrets stay exported, not in flags", () => {
    const command = buildGarageCommand(credentials, "ollama", { bridge: true, runtimeApiKey: "runtime-test", models: ["qwen3:4b"] });
    expect(command).toContain("export GARAGEAI_SETUP_KEY='setup-test' GARAGEAI_REGISTER_TOKEN='register-test' GARAGEAI_RUNTIME_API_KEY='runtime-test'");
    const run = command.split("\n").slice(2).join("\n");
    expect(run).toContain("garageai connect");
    expect(run).not.toMatch(/setup-test|register-test|runtime-test|--runtime-api-key/);
  });
  test("mesh rerun skips install and omits setup key and management URL", () => {
    const command = buildGarageCommand({ ...credentials, setup_key: null }, "ollama", { bridge: true });
    expect(command).toContain("--skip-install");
    expect(command).not.toContain("GARAGEAI_SETUP_KEY");
    expect(command).not.toContain("--management-url");
  });
});