import { expect, test } from "bun:test";
import { ACCOUNT_TERMS_VERSION, accountTermsAccepted, hasCurrentAccountTerms, shouldShowAccountTermsNotice } from "../../supabase/functions/_shared/accountTerms";

test("new signups accept version 2026-10-25", () => expect(ACCOUNT_TERMS_VERSION).toBe("2026-10-25"));
test("an account with no acceptance cannot perform protected actions", () => expect(hasCurrentAccountTerms({ terms_version: null })).toBe(false));
test("an older acceptance cannot perform protected actions", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-16" })).toBe(false));
test("the current acceptance permits protected actions", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-25" }, new Date("2026-11-09T00:00:00Z"))).toBe(true));
test("2026-10-17 retains full access until 9 November", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-17" }, new Date("2026-11-08T23:59:59Z"))).toBe(true));
test("2026-10-17 expires on 9 November UTC", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-17" }, new Date("2026-11-09T00:00:00Z"))).toBe(false));
test("existing acceptance shows the new-version notice", () => expect(shouldShowAccountTermsNotice({ terms_version: "2026-10-17" })).toBe(true));
test("accepting 2026-10-25 hides its notice", () => expect(shouldShowAccountTermsNotice({ terms_version: "2026-10-25" })).toBe(false));
test("dismissed but not accepted shows the notice again on reload", () => {
  const profile = { terms_version: "2026-10-17", terms_notice_dismissed_version: "2026-10-25" };
  expect(shouldShowAccountTermsNotice(profile)).toBe(true);
  expect(hasCurrentAccountTerms(profile, new Date("2026-11-08T23:59:59Z"))).toBe(true);
  expect(hasCurrentAccountTerms(profile, new Date("2026-11-09T00:00:00Z"))).toBe(false);
});
test("dismissal of an earlier version does not hide a changed-version notice", () => expect(shouldShowAccountTermsNotice({ terms_version: "2026-10-17", terms_notice_dismissed_version: "2026-10-17" })).toBe(true));
test("edge guard reads only the authenticated user's acceptance", async () => {
  let selectedUser = "";
  const client = { from: (table: string) => {
    expect(table).toBe("profiles");
    return { select: () => ({ eq: (_column: string, user: string) => {
      selectedUser = user;
      return { maybeSingle: async () => ({ data: { terms_version: "2026-10-25" }, error: null }) };
    } }) };
  } };
  expect(await accountTermsAccepted(client, "own-user")).toBe(true);
  expect(selectedUser).toBe("own-user");
});
test("missing profiles fail closed", async () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  expect(await accountTermsAccepted(client, "own-user")).toBe(false);
});