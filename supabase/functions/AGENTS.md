# Edge functions
- Delete garages only via the `delete-garage` edge function (NetBird non-fatal → LiteLLM → credentials → rows); ledger tables (hourly stats, price history) carry `garage_name` and no FK so statements survive deletion.
- Build every LiteLLM garage deployment only via `buildDeploymentSpec` in `_shared/garageRouting.ts` (key from `garage_runtime_secrets`, sha256 `key_fingerprint`, token limits from `garage_models.context_length`); drift compares every written field so unchanged syncs make no calls.
- Record operator prompt-confidentiality acceptance only via `_shared/garageTerms.ts` (version string + fields) in create-garage, create-provider and set-garage-terms, so acceptance is server-enforced and versioned in one place.
