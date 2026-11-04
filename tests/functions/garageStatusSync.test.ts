import { expect, test } from "bun:test";
import { statusFromSample } from "../../supabase/functions/_shared/garageStatusSync";

test("Bridge garage with a stale heartbeat becomes offline", () => {
  expect(statusFromSample({ status: "online", connection_type: "mesh" }, "no_heartbeat")).toBe("offline");
});

test("Bridge garage comes back online when the sample is online again", () => {
  expect(statusFromSample({ status: "offline", connection_type: "mesh" }, null)).toBe("online");
});

test("endpoint garages keep their own status logic", () => {
  expect(statusFromSample({ status: "online", connection_type: "endpoint" }, "no_heartbeat")).toBeNull();
});

test("failed_test is not overwritten by an online sample", () => {
  expect(statusFromSample({ status: "failed_test", connection_type: "mesh" }, null)).toBeNull();
});
