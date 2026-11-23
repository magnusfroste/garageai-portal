import { expect, test } from "bun:test";
import { MAIL_DEFAULTS, providerAllowsKind, sendMail } from "../../supabase/functions/_shared/eventMail";

const msg = { from_email: "support@garageai.eu", from_name: "GarageAI", to: "a@b.se", subject: "S", textContent: "T", htmlContent: "<p>T</p>", headers: { "List-Unsubscribe": "<x>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
const env = (vals: Record<string, string>) => (n: string) => vals[n];

test("default provider is cloudflare and mode stays off", () => {
  expect(MAIL_DEFAULTS.provider).toBe("cloudflare");
  expect(MAIL_DEFAULTS.mode).toBe("off");
});
test("marketing templates are never sent through cloudflare", () => {
  expect(providerAllowsKind("cloudflare", "marketing")).toBe(false);
  expect(providerAllowsKind("cloudflare", "service")).toBe(true);
  expect(providerAllowsKind("brevo", "marketing")).toBe(true);
});
test("missing secret for the chosen provider fails with no mail key and sends nothing", async () => {
  let called = false;
  const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
  expect(await sendMail("cloudflare", msg, env({ BREVO_API_KEY: "k", CLOUDFLARE_MAIL_TOKEN: "t" }), f)).toEqual({ ok: false, error: "no mail key", definite: true });
  expect(await sendMail("brevo", msg, env({ CLOUDFLARE_MAIL_TOKEN: "t", CLOUDFLARE_MAIL_ACCOUNT_ID: "a" }), f)).toEqual({ ok: false, error: "no mail key", definite: true });
  expect(called).toBe(false);
});
test("cloudflare request shape and success:false is a failure with the first error, never the token", async () => {
  let url = "", init: RequestInit | undefined;
  const f = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(JSON.stringify({ success: false, errors: [{ message: "sender not verified" }] }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await sendMail("cloudflare", msg, env({ CLOUDFLARE_MAIL_TOKEN: "secret-token", CLOUDFLARE_MAIL_ACCOUNT_ID: "acc1" }), f);
  expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc1/email/sending/send");
  expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  const body = JSON.parse(String(init!.body));
  expect(body.from).toEqual({ address: "support@garageai.eu", name: "GarageAI" });
  expect(body.to).toBe("a@b.se");
  expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  expect(r).toEqual({ ok: false, error: "sender not verified", definite: true });
});
test("cloudflare non-2xx is failed", async () => {
  const f = (async () => new Response("bad", { status: 403 })) as unknown as typeof fetch;
  const r = await sendMail("cloudflare", msg, env({ CLOUDFLARE_MAIL_TOKEN: "t", CLOUDFLARE_MAIL_ACCOUNT_ID: "a" }), f);
  expect(r.ok).toBe(false);
});
