import { expect, test } from "bun:test";
import { tokenRenewalRequest } from "@/models/services/garageCommand";

test("advanced token renewal uses only register credentials", () => {
  expect(tokenRenewalRequest("garage-m2")).toEqual({ name: "garage-m2", terms_accepted: true });
});
