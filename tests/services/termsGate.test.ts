import { expect, test } from "bun:test";
import { runWithTermsAcceptance, TermsNotAcceptedError } from "@/models/services/termsGate";

test("a blocked action offers accept and continues after accepting", async () => {
  let accepted = false; let asked = 0;
  const createKey = async () => { if (!accepted) throw new TermsNotAcceptedError(); return "key-created"; };
  const result = await runWithTermsAcceptance(createKey, async () => { asked++; accepted = true; return true; });
  expect(asked).toBe(1);
  expect(result).toBe("key-created");
});

test("a server refusal with code terms_not_accepted also offers accept", async () => {
  let accepted = false; let asked = 0;
  const refusal = { context: { clone: () => ({ json: async () => ({ code: "terms_not_accepted" }) }) } };
  const result = await runWithTermsAcceptance(async () => { if (!accepted) throw refusal; return "ok"; }, async () => { asked++; accepted = true; return true; });
  expect([asked, result]).toEqual([1, "ok"]);
});

test("declining the terms does not run the action", async () => {
  let ran = 0;
  await expect(runWithTermsAcceptance(async () => { ran++; throw new TermsNotAcceptedError(); }, async () => false)).rejects.toBeInstanceOf(TermsNotAcceptedError);
  expect(ran).toBe(1);
});
