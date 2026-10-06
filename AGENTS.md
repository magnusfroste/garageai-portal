# Project architecture

- Compose public garage cards and profile headers through the shared public garage service and header, using only existing aggregate RPCs and canonical model identities, so public views agree without exposing runtime identifiers.

- Keep application flow separated as repositories → services/models → hooks → views so data access and UI remain independently maintainable.
- Keep deployment-specific branding in `admin_settings.site_settings`; component defaults are neutral white-label fallbacks.
- Keep signup intent as profile product metadata, never as an authorization role; authorization remains in `user_roles`.
- Route both initial node registration and changed heartbeats through the shared garage registration service so deployment cleanup and catalogue sync stay consistent.
- Keep runtime metadata in one frontend service and backend port allowlisting in one shared edge-function constant so setup commands and validation stay aligned.- Compute garage reliability grades only in the `garage_reliability` database function, fed by the five-minute cron (samples, usage ingest, hourly probes), so every view shows the same numbers.
- Define portal navigation groups only in `src/models/services/navigation.ts`; public-readable pages use `PublicOrAppLayout` so visitors and signed-in users share routes.
- Build the buyer catalogue (one entry per base model, garages as providers) only in `catalogService.buildCatalog` from public data (curated_models + public garage RPCs), so list and model pages agree.
- Track why a catalogue model is off in `curated_models.disabled_reason` (admin vs failed_test); only syncModels re-enables failed_test rows on a pass, never admin-disabled ones.
- Decide tool-calling support only from the acceptance-test tool probe (`garage_model_tests.supports_tools`, read publicly via `garage_tool_support`); the chat backend and UI share the same "garage/<g>/<m> vs pool" matching so the Webbsök toggle and server agree.
- Route every user-facing string through `t()` from `src/i18n` (English source strings, translations in `src/i18n/<lang>.ts`); stored site_settings text is English at top level with per-language overrides in `translations.<lang>`, merged only in `useSiteSettings` for display.
- Reconcile LiteLLM garage deployments from database status and tests on every sync; only sellable models may have routes, while acceptance probes use temporary private routes.
- Grant purchased credits through one idempotent shared claim path, and define total user/key budget as starting credit plus purchased credits.
- Read signup starter credit from the public default-budget setting, never from translated branding; signup profiles use that same setting with zero fallback.
- Generate garage setup commands as download / `export` secrets / run lines (zsh and bash safe); with sudo, use `--preserve-env` rather than putting secrets in flags.
- Render connect commands through the shared OS selector and resolve demand model IDs in a service by runtime; runtime-specific IDs avoid unmatched install filters.
- Treat gateway health reports (L1 tunnel, L2 /v1/models) as the primary routing signal for garages that have one; heartbeats only carry inventory, and only `garage_models.offered` models may be routed.

- Audit garage price changes with an atomic database trigger, then reconcile both token prices; statements always sum recorded request spend to preserve historical rates.
- Read operator earnings through an ownership-scoped aggregate RPC; estimates are separate from invoice totals to prevent current-price repricing.
- Keep garage_models.model as the runtime id (sent upstream, never shown to buyers) and canonical_model as the catalogue/pool name; canonical names are OpenRouter-style `<creator>/<model>` from the org/family tables in shared `modelIdentity.ts` (mirrored in SQL `normalise_model_id`), mesh names always normalised by the DB trigger, model pages use a splat route because names contain `/`, only admins may alias endpoint-provider models, and deployment ids stay derived from the runtime id.
- Delete garages only via the `delete-garage` edge function (NetBird non-fatal → LiteLLM → credentials → rows); ledger tables (hourly stats, price history) carry `garage_name` and no FK so statements survive deletion.
- Build every LiteLLM garage deployment only via `buildDeploymentSpec` in `_shared/garageRouting.ts` (key loaded from `garage_runtime_secrets`, `model_info.key_fingerprint` = first 8 hex of sha256 or "none"); drift compares fingerprint, route, upstream model, api_base and costs so a changed key is rewritten once and unchanged syncs make no calls.
- Record operator prompt-confidentiality acceptance only via `_shared/garageTerms.ts` (version string + fields) in create-garage, create-provider and set-garage-terms, so acceptance is server-enforced and versioned in one place.
