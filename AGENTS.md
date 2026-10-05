# Project architecture

- Keep application flow separated as repositories → services/models → hooks → views so data access and UI remain independently maintainable.
- Keep deployment-specific branding in `admin_settings.site_settings`; component defaults are neutral white-label fallbacks.
- Keep signup intent as profile product metadata, never as an authorization role; authorization remains in `user_roles`.
- Route both initial node registration and changed heartbeats through the shared garage registration service so deployment cleanup and catalogue sync stay consistent.
- Keep runtime metadata in one frontend service and backend port allowlisting in one shared edge-function constant so setup commands and validation stay aligned.- Compute garage reliability grades only in the `garage_reliability` database function, fed by the five-minute cron (samples, usage ingest, hourly probes), so every view shows the same numbers.
- Define portal navigation groups only in `src/models/services/navigation.ts`; public-readable pages use `PublicOrAppLayout` so visitors and signed-in users share routes.
- Build the buyer catalogue (one entry per base model, garages as providers) only in `catalogService.buildCatalog` from public data (curated_models + public garage RPCs), so list and model pages agree.
- Track why a catalogue model is off in `curated_models.disabled_reason` (admin vs failed_test); only syncModels re-enables failed_test rows on a pass, never admin-disabled ones.
- Decide tool-calling support only from the acceptance-test tool probe (`garage_model_tests.supports_tools`, read publicly via `garage_tool_support`); the chat backend and UI share the same "garage/<g>/<m> vs pool" matching so the Webbsök toggle and server agree.
- Run chat web search server-side in `chat-playground/webSearch.ts` (SearXNG, max 3 tool rounds) and stream `garageai` status events alongside OpenAI chunks; never log queries, results or prompts.
- Route every user-facing string through `t()` from `src/i18n` (English source strings, translations in `src/i18n/<lang>.ts`); stored site_settings text is English at top level with per-language overrides in `translations.<lang>`, merged only in `useSiteSettings` for display.
- Chat answer footer data (garage, usage) comes only from chat-playground `garageai` meta events (garage = LiteLLM deployment-id prefix) plus `include_usage` chunks; cost/tok/s are computed client-side in `chatService` from catalogue prices.
- Reconcile LiteLLM garage deployments from database status and tests on every sync; only sellable models may have routes, while acceptance probes use temporary private routes.
- Grant purchased credits through one idempotent shared claim path, and define total user/key budget as starting credit plus purchased credits.
- Generate garage setup commands with credentials in shell environment variables; with sudo, pass them through `sudo env` rather than command-line flags.
