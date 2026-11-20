import { expect, test } from "bun:test";
import { MAIL_DEFAULTS, MAIL_RUN_LIMIT, mailAccountAllowed, mailCapReached, mailDelayMinutes, mailToken, renderMail, verifyMailToken } from "../../supabase/functions/_shared/eventMail";

test("event mail ships Off and evaluates no accounts", () => {
  expect(MAIL_DEFAULTS.mode).toBe("off");
  expect(mailAccountAllowed(MAIL_DEFAULTS, true, null)).toBe(false);
});
test("Test evaluates marked accounts only and replaces 2 and 3 day delays with 10 minutes", () => {
  const settings = { ...MAIL_DEFAULTS, mode: "test" as const };
  expect(mailAccountAllowed(settings, false, null)).toBe(false);
  expect(mailAccountAllowed(settings, true, null)).toBe(true);
  for (const key of ["first_request_nudge", "connect_garage_nudge", "garage_offline"]) expect(mailDelayMinutes(key, settings)).toBe(10);
});
test("On excludes opted-out accounts and uses the specified delays", () => {
  const settings = { ...MAIL_DEFAULTS, mode: "on" as const };
  expect(mailAccountAllowed(settings, false, null)).toBe(true);
  expect(mailAccountAllowed(settings, true, "2026-11-20T00:00:00Z")).toBe(false);
  expect(mailDelayMinutes("first_request_nudge", settings)).toBe(2880);
  expect(mailDelayMinutes("connect_garage_nudge", settings)).toBe(4320);
  expect(mailDelayMinutes("garage_offline", settings)).toBe(4320);
});
test("account caps are one per rolling seven days and three total with at most 20 per run", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  expect(mailCapReached(3, [], MAIL_DEFAULTS, now)).toBe(true);
  expect(mailCapReached(2, ["2026-11-14T12:00:00Z"], MAIL_DEFAULTS, now)).toBe(true);
  expect(mailCapReached(2, ["2026-11-12T12:00:00Z"], MAIL_DEFAULTS, now)).toBe(false);
  expect(MAIL_RUN_LIMIT).toBe(20);
});
test("unsubscribe HMAC is account-bound and rejects a modified id signature or extra component", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const fixtureSecret = "mail-test-fixture-not-a-runtime-secret";
  const token = await mailToken(id, fixtureSecret);
  expect(await verifyMailToken(token, fixtureSecret)).toBe(id);
  expect(await verifyMailToken(token.replace(id, "00000000-0000-0000-0000-000000000002"), fixtureSecret)).toBeNull();
  expect(await verifyMailToken(token, "different-test-fixture")).toBeNull();
  expect(await verifyMailToken(`${token}.extra`, fixtureSecret)).toBeNull();
  expect(await verifyMailToken("invalid", fixtureSecret)).toBeNull();
});
test("mail rendering substitutes the chosen language and escapes dynamic values in HTML", () => {
  const rendered = renderMail({ key: "garage_offline", enabled: true, subject_en: "Garage {{garage_name}}", body_en: "Offline {{days_offline}}", subject_sv: "Garage {{garage_name}}", body_sv: "Offline {{days_offline}}, nyckel {{key_hint}}" }, "sv", { garage_name: "<script>bad</script>", days_offline: "3", key_hint: "ABCD" }, "https://app.garageai.eu/mail/unsubscribe?t=fixture");
  expect(rendered.textContent).toContain("Offline 3, nyckel ABCD");
  expect(rendered.htmlContent).not.toContain("<script>");
  expect(rendered.textContent).toContain("Avsluta mejl");
});