import { expect, test } from "bun:test";
import { buyerOf, classifyRequest, type BuyerDirectory } from "../../supabase/functions/_shared/earningsBucket";

const OP = "operator-1", BUYER = "buyer-2";
const bought = Date.parse("2026-10-20T12:00:00Z");
const dir: BuyerDirectory = { byKey: new Map([["hashed-tok", BUYER], ["op-tok", OP]]), byAlias: new Map([["abcd1234-default-x1y2", BUYER]]), firstPurchase: new Map([[BUYER, bought]]) };

test("the operator's own request is own, even if they bought credit", () => {
  expect(classifyRequest({ buyer: OP, operator: OP, startMs: bought + 1, firstPurchaseMs: bought })).toBe("own");
});

test("a buyer who never bought credit is trial", () => {
  expect(classifyRequest({ buyer: BUYER, operator: OP, startMs: bought })).toBe("trial");
});

test("a different user who has bought credit is payable", () => {
  expect(classifyRequest({ buyer: BUYER, operator: OP, startMs: bought + 60_000, firstPurchaseMs: bought })).toBe("payable");
});

test("a buyer who pays later: earlier requests stay trial, later ones are payable", () => {
  expect(classifyRequest({ buyer: BUYER, operator: OP, startMs: bought - 1, firstPurchaseMs: bought })).toBe("trial");
  expect(classifyRequest({ buyer: BUYER, operator: OP, startMs: bought, firstPurchaseMs: bought })).toBe("payable");
});

test("unknown buyers and internal traffic never earn", () => {
  expect(classifyRequest({ buyer: null, operator: OP, startMs: bought + 1 })).toBe("trial");
  expect(classifyRequest({ buyer: BUYER, operator: OP, startMs: bought + 1, firstPurchaseMs: bought, internal: true })).toBe("trial");
});

test("buyer resolves from key token or alias, never the key name", () => {
  expect(buyerOf({ api_key: "hashed-tok" }, dir)).toBe(BUYER);
  expect(buyerOf({ api_key: "other", metadata: { user_api_key_alias: "abcd1234-default-x1y2" } }, dir)).toBe(BUYER);
  expect(buyerOf({ api_key: "other", metadata: { user_api_key_alias: "Default" } }, dir)).toBeNull();
});
