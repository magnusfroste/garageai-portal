# Project architecture

- Public garage cards/headers use shared public service/header, aggregate RPCs and canonical identities, never runtime ids.
- Flow stays repositories → services/models → hooks → views, so data and UI stay independent.
- Derive admin garage status, attention, filtering and sorting in the shared presentation service, so all admin views agree.
- Keep deployment-specific branding in `admin_settings.site_settings`; component defaults are white-label fallbacks.
- Keep signup intent as profile metadata, never an authorization role; roles stay in `user_roles`.
- Route initial node registration and changed heartbeats through the shared garage registration service, so cleanup and catalogue sync stay consistent.
- Centralize runtime metadata, allowed ports, Bridge-first commands and onboarding tool; resolve demand IDs by runtime to match install filters.
- Compute garage reliability grades only in the `garage_reliability` database function, fed by the five-minute cron, so every view agrees.
- Define portal navigation groups only in `src/models/services/navigation.ts`; public-readable pages use `PublicOrAppLayout`, so visitors and users share routes.
- Build the buyer catalogue (one entry per base model, garages as providers) only in `catalogService.buildCatalog` from public data (curated_models + public garage RPCs), so list and model pages agree.
- Track why a catalogue model is off in `curated_models.disabled_reason` (admin vs failed_test); only syncModels re-enables failed_test rows on a pass, never admin-disabled ones.
- Decide tool-calling support only from the acceptance-test probe (`garage_model_tests.supports_tools`, public via `garage_tool_support`); chat backend and UI share one "garage/<g>/<m> vs pool" match.
- Route user-facing strings through `t()` (`src/i18n`, English source, translations in `src/i18n/<lang>.ts`); site_settings text is English with `translations.<lang>` overrides merged only in `useSiteSettings`.
- Reconcile LiteLLM deployments from database status and tests on every sync; only sellable models get routes, acceptance probes use temporary private routes.
- Grant purchased credits through one idempotent shared claim path; total budget = starting credit + purchased credits.
- Read signup starter credit from the public default-budget setting, never translated branding; signup profiles use it with zero fallback.
- Generate setup commands as download / `export` secrets / run lines (zsh and bash safe); with sudo use `--preserve-env`, never secrets in flags.
- Treat gateway health reports (L1 tunnel, L2 /v1/models) as the primary routing signal where present; heartbeats carry inventory only, and only `garage_models.offered` models route.
- Audit garage price changes with an atomic database trigger, then reconcile both token prices; statements always sum recorded request spend to keep historical rates.
- Read operator earnings through an ownership-scoped aggregate RPC; estimates stay separate from invoice totals to prevent current-price repricing.
- Keep garage_models.model as the runtime id (sent upstream, never shown to buyers) and canonical_model as the catalogue/pool name: OpenRouter-style `<creator>/<model>` from the org/family tables in `modelIdentity.ts` (SQL mirror `normalise_model_id`), mesh names normalised by the DB trigger, model pages use a splat route (names contain `/`), only admins may alias endpoint-provider models, deployment ids derive from the runtime id.
- Record connect-script progress only via the `onboarding-report` edge function (register-token auth, service-role insert, rate-limited, newest 200 kept); derive step states only in `onboardingProgress.ts`, so wizard, admin Supply and gateway agree.
- Issue garage credentials (register token, setup key, old-peer cleanup) only via `_shared/garageCredentials.ts`; create-garage and the Bridge link share it, so both enforce the same limits.
- Plan garageai/auto deployments only in `_shared/autoRoute.ts` on top of the normal desired set inside reconcileGarageRouting; auto ids are `auto__<curated id>`, so usage ingest credits the entry's own garage.

## Where logic lives

- Announcements use repository → service → hook → views; RLS enforces audience/window/admin access and the signed-in shell owns the bar, preventing public exposure.

- The portal decides what should hold: people's decisions and business terms (models for sale, prices, the garageai/auto list, garages, owners, terms, earnings, accounts, onboarding). The gateway (LiteLLM) carries it out within seconds: routing, failover, cooldown, context checks, health. Never build a fast reaction (failover, retries, timeouts, blocking) as a portal function on a schedule. Never make a routing or health decision from gateway data gathered while the gateway itself is unreachable: treat it as inconclusive. Routing, pricing and health code needs tests. Full rationale: https://github.com/magnusfroste/garageai/blob/main/docs/architecture.md (syncModels moves into a separate control plane when there is more than one gateway or region).
