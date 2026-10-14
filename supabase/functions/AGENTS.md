# Edge function rules

- Issue garage credentials (register token, setup key, old-peer cleanup) only via `_shared/garageCredentials.ts`; create-garage and the Bridge link share it, so both enforce the same limits.
- Plan garageai/auto deployments only in `_shared/autoRoute.ts` on top of the normal desired set inside reconcileGarageRouting; auto ids are `auto__<curated id>`, so usage ingest credits the entry's own garage.
- Ops-test managed-model requests go through `managed-models-ops` (gateway key) and the shared `apply_managed_model_request`/`apply_managed_model_cancel` SQL path, limited to admin-owned garages, so nightly tests use the exact Add/Remove/Cancel rules and never touch operator machines.
