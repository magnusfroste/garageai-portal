# Event mail — off by default, with test mode

## Result
- Add **Settings → Mail** with Off / Test / On, test-account search, bilingual template editing, previews, manual test sending, and the latest 100 log entries.
- Publish with `event_mail.mode = "off"`. Off returns before rule evaluation or sending. No mail is sent during implementation.
- Add the account mail switch and a public unsubscribe page with Undo. Auth mail and Stripe receipts remain untouched.
- Use plain PostgreSQL and Brevo’s direct HTTP API, one new `event-mail` function, and one job every 15 minutes. No Lovable Emails or auth mail templates.

## Rules and safeguards
- Evaluate the three supplied rules using the earliest non-internal key and existing first-use evidence (successful account request or saved conversation). Keep local-only chat privacy unchanged.
- In Test, evaluate only `mail_test` accounts and replace the 2-/3-day delays with `test_delay_minutes` (default 10).
- Exclude opted-out accounts, paused garages, never-reporting garages, and duplicate sent events. Apply account-wide caps of 1 per rolling seven days and 3 total; send at most 20 messages per scheduled run.
- Maintain backend-only durable cap/dedupe state separately from the 12-month log retention, so pruning cannot reset lifetime limits or resend old events. Serialize overlapping runs and recheck eligibility before delivery.
- Manual tests require a signed-in admin, target only that admin, bypass rules/caps, and log `manual-test`. Repeated manual tests must remain possible despite the successful-send uniqueness rule; replace the previous successful manual-test log under a lock before recording the next one. Manual tests do not consume automated-mail caps.
- Switching On asks for confirmation and displays the eligible-account count without sending.

## Mail content and unsubscribe
- Seed the supplied English/Swedish templates enabled, but keep global mode Off. Escape substituted values when wrapping plain text in a simple logo-line/text/footer layout; send both HTML and text.
- Match actual page/button labels, including **API keys / API-nycklar**, and verify the current connection label before seeding.
- Verify whether the gateway accepts the supplied `"auto"` example; preserve it if valid, otherwise use the existing canonical `garageai/auto` and report the correction.
- Use a signed token containing the account id and its HMAC; verify it server-side without sign-in. GET displays the page only; a token-authenticated POST opts out, including RFC one-click POSTs. Undo is an explicit action using the same verified token. No email addresses appear in the token.
- Send List-Unsubscribe and List-Unsubscribe-Post headers. Keep secrets, complete keys and mail bodies out of logs.

## Technical details
- Apply additive migrations for profile mail fields, admin-only templates/logs, backend-only delivery state, protected mail operations, and an admin-only `event_mail` setting seeded Off. Protect `mail_test` against self-enablement; people can only change their own mail preference/language.
- Preserve repository → service → hook → view separation. Save `mail_language` on language switches and first signed-in load after this change; retain existing `preferred_language` behavior.
- The one new function handles authenticated scheduled runs, admin preview/manual-test requests, and signed unsubscribe/undo operations with validated inputs and CORS on every response.
- Repair managed cron authentication if required, then schedule `event-mail` every 15 minutes (96 invocations/day; maximum ordinary evaluation delay 15 minutes). Prune 12-month logs in this same job even while Off; Off still performs no event evaluation or sending.
- Add counts-only `mail` statistics to `ops-summary`; do not change functions called by Door or the gateway beyond this requested Ops addition.

## Secrets and verification
- Neither `BREVO_API_KEY` nor `MAIL_LINK_SECRET` is currently configured. Add them in **Project Settings → Secrets**, never chat: your Brevo API key and a strong random shared signing value (32 random bytes in hex). Build can remain Off without either; missing Brevo credentials record `failed: "no mail key"` when a send is attempted. Missing signing credentials also prevent sending.
- Verify database protections, Off/Test/On eligibility, delays, caps, dedupe, overlapping runs, pause rules, language, escaping, HMAC tampering, unsubscribe/undo, and manual-test isolation. Run the full suite and runtime checks, then check admin/account/public flows on desktop and mobile.
- Do not send a real manual test until the secrets exist and the signed-in admin deliberately uses **Send test to me**. Report real delivery as unverified if this cannot be exercised.
- Deploy `event-mail` and the changed `ops-summary`; publish the app only with mode confirmed Off.
- Final report: migration names, cron name/schedule, today's On-mode match counts for each rule (no identities), tests, template wording corrections, and confirmed Off state.
