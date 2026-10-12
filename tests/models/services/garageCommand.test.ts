import { expect, test } from "bun:test";
import { tokenRenewalRequest } from "@/models/services/garageCommand";

test("advanced token renewal never asks for a NetBird setup key", () => {
  expect(tokenRenewalRequest("garage-m2")).toEqual({ name: "garage-m2", create_setup_key: false, terms_accepted: true });
});
