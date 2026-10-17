import { expect, test } from "bun:test";
import { ACCOUNT_TERMS_VERSION, accountTermsAccepted, hasCurrentAccountTerms } from "../../supabase/functions/_shared/accountTerms";

test("current account terms version is 2026-10-17", () => expect(ACCOUNT_TERMS_VERSION).toBe("2026-10-17"));
test("an account with no acceptance cannot perform protected actions", () => expect(hasCurrentAccountTerms({ terms_version: null })).toBe(false));
test("an older acceptance cannot perform protected actions", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-16" })).toBe(false));
test("the current acceptance permits protected actions", () => expect(hasCurrentAccountTerms({ terms_version: "2026-10-17" })).toBe(true));
test("edge guard reads only the authenticated user's acceptance", async () => {
  let selectedUser = "";
  const client = { from: (table: string) => {
    expect(table).toBe("profiles");
    return { select: () => ({ eq: (_column: string, user: string) => {
      selectedUser = user;
      return { maybeSingle: async () => ({ data: { terms_version: "2026-10-17" }, error: null }) };
    } }) };
  } };
  expect(await accountTermsAccepted(client, "own-user")).toBe(true);
  expect(selectedUser).toBe("own-user");
});
test("missing profiles fail closed", async () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  expect(await accountTermsAccepted(client, "own-user")).toBe(false);
});