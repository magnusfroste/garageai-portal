import { expect, test } from "bun:test";
import { USER_CODE_RE, decidePoll, machineConflict, makeUserCode, normaliseUserCode, parseStartBody, type LinkRow } from "../../supabase/functions/_shared/bridgeLink";
import { decideSetupKey, ownershipError } from "../../supabase/functions/_shared/garageCredentialRules";

test("user codes are ABCD-EFGH without I, O, 0 or 1", () => {
  for (let i = 0; i < 500; i++) {
    const c = makeUserCode();
    expect(c).toMatch(USER_CODE_RE);
    expect(c).not.toMatch(/[IO01]/);
  }
  expect(normaliseUserCode("abcd efgh")).toBe("ABCD-EFGH");
  expect(normaliseUserCode("ABCD-EFG1")).toBeNull();
});

test("start body: suggested name is sanitised, long strings and too many models rejected", () => {
  expect(parseStartBody({ suggested_name: "Garage M2.local" }).fields?.suggested_name).toBe("garage-m2-local");
  expect(parseStartBody({ hostname: "h".repeat(129) }).error).toBeTruthy();
  expect(parseStartBody({ models: Array(51).fill("m") }).error).toBeTruthy();
});

const now = Date.parse("2026-10-11T12:00:00Z");
const base: LinkRow = { status: "pending", expires_at: "2026-10-11T12:05:00Z", last_poll_at: null, credentials: null, garage: null };

test("poll: pending", () => expect(decidePoll(base, now).body).toEqual({ status: "pending" }));
test("poll: slow_down within 2 s", () => expect(decidePoll({ ...base, last_poll_at: new Date(now - 1000).toISOString() }, now).body.status).toBe("slow_down"));
test("poll: approved once, then picked_up", () => {
  const row: LinkRow = { ...base, status: "approved", garage: { id: "g", name: "m2" }, credentials: { register_token: "grg_x", setup_key: null, register_url: "r", management_url: "m" } };
  const d = decidePoll(row, now);
  expect(d.body).toEqual({ status: "approved", garage: { id: "g", name: "m2" }, register_url: "r", register_token: "grg_x", setup_key: null, management_url: "m" });
  expect(d.patch).toMatchObject({ status: "picked_up", credentials: null });
  expect(decidePoll({ ...row, ...d.patch } as LinkRow, now + 3000).body).toEqual({ status: "picked_up" });
});
test("poll: expired clears credentials", () => {
  const d = decidePoll({ ...base, status: "approved", credentials: { register_token: "x" }, garage: { id: "g", name: "n" } }, Date.parse("2026-10-11T12:06:00Z"));
  expect(d.body).toEqual({ status: "expired" });
  expect(d.patch).toMatchObject({ status: "expired", credentials: null });
});

test("approve: other machine is rejected without replace_machine", () => expect(machineConflict("mac-a", "mac-b", false)).toBe("mismatch"));
test("approve: other machine is replaced with replace_machine", () => expect(machineConflict("mac-a", "mac-b", true)).toBe("replace"));
test("approve: same or unknown machine is fine", () => {
  expect(machineConflict("mac-a", "mac-a", false)).toBe("ok");
  expect(machineConflict(null, "mac-b", false)).toBe("ok");
});

test("create-garage rules unchanged: operators always get a setup key unless they opt out with a peer", () => {
  expect(decideSetupKey(undefined, false, true)).toBe(true);
  expect(decideSetupKey(false, false, true)).toBe(false);
  expect(decideSetupKey(false, false, false)).toBe(true);
  expect(decideSetupKey(false, true, false)).toBe(false);
  expect(decideSetupKey(undefined, true, true)).toBe(true);
});
test("create-garage rules unchanged: ownership, 5-garage limit and 10 per day", () => {
  expect(ownershipError({ operator_id: "other" }, "me", false, 0, 0)?.status).toBe(409);
  expect(ownershipError({ operator_id: "me", disabled: true }, "me", false, 0, 0)?.status).toBe(403);
  expect(ownershipError(null, "me", false, 5, 0)?.error).toBe("You can have at most 5 garages");
  expect(ownershipError({ operator_id: "me" }, "me", false, 0, 10)?.status).toBe(429);
  expect(ownershipError({ operator_id: "other" }, "me", true, 9, 99)).toBeNull();
});
