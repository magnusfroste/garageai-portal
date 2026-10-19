# Edge function rules
- Chat is privacy-first: the browser calls the EU gateway directly; `chat-key-value` returns a key's value only to its signed-in owner, and `web-search` receives only a query string, never messages. Chat history is local by default; `chat_conversations` is written only when the user opts in to sync.
- Reconcile LiteLLM deployments from database status and tests on every sync; only sellable models get routes, acceptance probes use temporary private routes.
- Models dropped after missed heartbeats keep offer/prices in `garage_model_memory`, restored by `syncInventory`, so re-links never reset sales.
- Classify internal keys before usage aggregation; customer aggregates alone feed demand and owner/public counters, while internal aggregates stay admin-only, preventing test-driven recommendations.

- Issue garage credentials (register token, setup key, old-peer cleanup) only via `_shared/garageCredentials.ts`; create-garage and the Bridge link share it, so both enforce the same limits.
- Plan garageai/auto deployments only in `_shared/autoRoute.ts` on top of the normal desired set inside reconcileGarageRouting; auto ids are `auto__<curated id>` for attribution, and order is written/compared in both `litellm_params` and `model_info` so gateway priority follows admin changes.
- Ops-test managed-model requests go through `managed-models-ops` (gateway key) and the shared `apply_managed_model_request`/`apply_managed_model_cancel` SQL path, limited to admin-owned garages, so nightly tests use the exact Add/Remove/Cancel rules and never touch operator machines.
- LiteLLM key_alias is internal `<uid8>-<slug>-<rand4>` (api_keys.litellm_alias), never shown; the portal name lives only in api_keys.name, because gateway aliases must be globally unique.
