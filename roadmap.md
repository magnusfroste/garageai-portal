# Roadmap

- [x] Validate Bridge energy/update reports; migration 0084 stores windows and atomic daily totals; 90-day daily cleanup; owner/admin/public/ops displays; 38 heartbeat tests and live rollback storage/weighted-efficiency/RLS checks passed; garage-m1 live energy window verified; backend deployed and publication requested
- [ ] Energy real signed-in owner/admin readback and gateway-authenticated ops response — blocked: requester has no matching auth account and no gateway session is available; public page and desktop/mobile summary fixtures verified

- [x] Preserve integer GPU watts (0–5000) and temperature (0–200); 22 tests passed, 142 W / 61 °C admin desktop/mobile fixtures verified, live dgx-city heartbeat stored 13 W / 45 °C; node-heartbeat deployed, frontend publication requested. gateway-targets already forwards agent.machine; ops-summary does not forward machine telemetry.
- [ ] GPU telemetry real signed-in admin verification — blocked: requester has no matching auth account; live heartbeat storage and admin desktop/mobile fixtures verified

- [x] Chat model choice: remembered healthy choice before Auto, newest awake owner machine on first visit, quiet asleep fallback with Switch back; 103 related tests passed, desktop/mobile fixture picker/reload/override verified, publication requested
- [ ] Chat choice real-account verification — blocked: no auth user matches requester; safe browser fixtures verified without account changes

- [x] Support availability: admin On/Away/Off setting, automatic UTC date expiry, Account read-only access, server Off guard and ops mode; English/Swedish, 95 tests and live rollback security checks passed, browser fixtures verified; publication requested

- [x] Ask Magnus: protected threads/messages, safe context and daily limits; signed-in dock/mobile/chat entry, stuck signals, admin inbox, anonymous ops statistics, Swedish; 92 related tests and live rollback security tests; ops deployed and verified
- [ ] Ask Magnus real signed-in end-to-end verification — blocked: no matching requester account and explicit Magnus session approval unavailable; desktop/mobile/chat/inbox fixture send/readback verified
- [ ] Ask Magnus privacy policy row — blocked: website source is in separate GitHub repository www/src/legal/privacy.md; exact additive patch prepared in docs/privacy-support.patch, cannot publish that external website here
- [x] Ask Magnus frontend publication requested alongside deployed compatible backend

- [x] My machine: heartbeat-owned free private deployments, owner visibility control, public exclusions, owner chat picker and API copy; migration 0079 applied, functions deployed, 93 tests passed; live 12 free private routes, paused retention and owner/other request checks verified; publish requested
- [ ] My machine signed-in visibility save/readback — blocked: requester has no matching auth account and explicit-account session approval is unavailable; desktop/mobile owner fixtures verified
- [ ] Gateway /v1/models listing — existing gateway returns 422 for both temporary owner and other keys; private owner requests return 200, other requests 404; portal picker uses protected owner reads independently

- [x] Credit hardening: shared key limits, 27-key verified backfill (4 internal excluded), atomic refund/dispute ledger and Stripe subscriptions, rename-only permissions, no implicit gateway keys, initial-balance fallback/retry; 34 tests and rollback SQL passed; no plaintext wipe
- [ ] Verify initial balance in a real signed-in signup flow — blocked: requester has no matching account/session

- [x] Allow original vendor models in admin endpoint providers and aliases; retain garage restrictions; native Anthropic adapter shared by probes/routes; 42 tests pass, compatible functions deployed and authenticated live validation checked without writes
- [ ] Verify a real Anthropic provider save and paid response — requires provider credential and an explicitly selected available model; no provider/account records changed during validation

- [x] Pass saved Auto priority into gateway routing params, add English/Swedish note; 18 tests passed and live /model/info verified integer orders 1/2/3 after normal reconciliation, without changing saved entries/prices

- [x] Add account terms storage, own-user acceptance and signup recording; protect key/payment/garage actions
- [x] Add signup checkbox, persistent app banner, legal links and admin terms column in English/Swedish
- [x] Add daily twelve-month onboarding retention; focused tests and fixture browser signup/banner checks; deployed changed functions
- [ ] Verify account terms with real signup/OAuth and signed-in acceptance — blocked: no requesting-user account/session; fixture flows checked
- [ ] Legal Terms/Privacy URLs must become reachable — supplied URLs return 404

- [x] Classify internal keys, separate customer demand/counters and show test totals only in Admin
- [x] Add first-sign-in AI/GPU paths and Overview fallback in English/Swedish
- [ ] Send once-only ten-minute welcome — blocked: sender domain not configured; eligibility/state prepared, sender and scheduling deferred
- [ ] Verify real-account first-sign-in — blocked: requesting user has no matching app account
- [x] Verify filtering/eligibility rules, migrations and deployment; desktop/mobile starting paths checked
- [ ] Verify live customer history replay — waiting for scheduled ingestion; unknown historical keys excluded conservatively

- [ ] Fetch Bridge releases every six hours, preserve admin pin and expose version setting safely
- [ ] Add operator update commands, admin version column/outdated filter and Operations Center version summary
- [ ] Test version rules, verify signed-in views, deploy functions and publish

- [x] Replace portal marks and favicon; add Apple touch icon; verified signed-in /connect and /bridge/link plus auth; theme/layout unchanged

- [x] Remove portal legacy scripts, retain Bridge linking and advanced token renewal; Swedish updated, 90 tests pass, build clean
- [ ] Verify signed-in Bridge-only controls — blocked: requesting user's email has no app account/session
- [x] Request publication of the Bridge-only portal

- [x] Add announcements schema, audience security, Admin management and signed-in bar (no seed rows)
- [x] Remove garage-card callout entirely; keep announcements only; tests pass and build clean
- [x] Verify announcement rule tests, public/auth exclusion and desktop/mobile previews
- [ ] Verify signed-in Admin save/read/dismiss flow — blocked: no session for the requesting account; no announcement rows permitted

- [x] Align public garage cards/profile headers with catalogue, verify anonymous data and desktop/mobile interactions

- [x] Clarify operator earnings and add audited admin pricing
- [x] Finish catalogue home, overview checklist, logs, reliability, credits and navigation
- [x] Review all pages at desktop/mobile sizes and report screenshots (previous clarity round)
- [x] Publish the current frontend — explicit deployment requested in the Bridge-first revision
- [x] Make Bridge the default, retain collapsed legacy commands, and display the latest connection tool
- [x] Verify shared Bridge-first controls at desktop/mobile sizes and connection rules (10 tests)
- [x] Request publication of this revision to app.garageai.eu (deployment scheduled)

- [x] Complete v1.0 onboarding review fixes 1–9 and verify mobile, commands, and starter credit
- [x] Request publication of the v1.0 onboarding review fixes to app.garageai.eu (deployment scheduled)

- [x] Audit the six remaining security/routing workstreams against current code and backend state
- [x] Complete routing reconciliation, hourly probes, and runtime-secret persistence
- [x] Complete connect-script command hardening and remove the legacy public script
- [x] Complete budgets, payments, LiteLLM user repair, and Stripe webhook handling
- [x] Complete render proxy and platform-traffic exclusions
- [x] Run typechecks and focused/live tests
- [x] Deploy backend functions and publish the frontend (previous review)
- [x] Report migration, test results, webhook URL/event, and external secret blocker (previous review)

- [x] Managed models step 1 (Add/Remove on My garages) and step 2 (offer page)
- [x] Rebuild My garage: status, earnings, offers and collapsed full-control Details; English/Swedish
- [x] Implement Smart settings, nightly 04:30 UTC selection, atomic daily limit and owner-only app notices
- [ ] Smart email notices — blocked: no project sender domain; email infrastructure/templates require domain setup
- [x] Test Smart/default/price/report rules; verify desktop/mobile fixture layout; deploy nightly function and verify safe no-op live
- [ ] Real-account Smart toggle, price save and fetch flow — blocked: requester has no app account; explicit-account session approval unavailable
- [x] Request publication of My garage and Smart to app.garageai.eu
