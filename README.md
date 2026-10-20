# GarageAI app

The web app at **[app.garageai.eu](https://app.garageai.eu)**: accounts, API keys, prepaid
credits, the chat, and My garages for people who offer their GPU. It is one part of
[GarageAI](https://www.garageai.eu), a marketplace for local AI inference in Europe.

The rest of the platform lives in the main repository,
**[magnusfroste/garageai](https://github.com/magnusfroste/garageai)**:

| There | What it is |
|---|---|
| `cli/` | GarageAI Bridge (`garageai`), the program that connects a garage |
| `infra/gateway/` | The LiteLLM gateway on an EU VPS, the tunnel hub, the Operations Center |
| `www/` | The site at www.garageai.eu |
| `docs/` | Architecture, specs and troubleshooting |

## What the app does

- **Buyers:** sign up, accept the terms, get a default key, add credits through Stripe, and call
  `https://api.garageai.eu/v1` (OpenAI-compatible) or chat in the browser. The chat sends prompts
  straight from the browser to the gateway. Conversations are saved in the account only if the
  user turns that on.
- **Garage owners:** connect a machine with Bridge (approved in the browser, no tokens to copy).
  Then choose which models to sell and at what price, pause, follow earnings, and use their own
  machine privately and free from anywhere under `mine/<garage>/<model>`
  ([My machine](https://github.com/magnusfroste/garageai/blob/main/docs/my-machine.md)).
- **Admins:** supply, onboarding, accounts, the curated catalogue and `garageai/auto`.

## Where logic lives

The app **decides**: models for sale, prices, the auto list, garages, owners, terms, earnings and
accounts. The gateway **carries it out** within seconds: routing, failover, context checks and
health. Fast reactions are never built as scheduled functions here. The full rationale is in
[docs/architecture.md](https://github.com/magnusfroste/garageai/blob/main/docs/architecture.md).
Rules for code changes are in [AGENTS.md](AGENTS.md) and `supabase/functions/AGENTS.md`.

| Path | What |
|---|---|
| `src/` | React + Vite + TypeScript + Tailwind (shadcn/ui). The flow is repositories → services/models → hooks → views. Strings go through `t()` in `src/i18n` (English source, Swedish). |
| `supabase/functions/` | Edge functions (Deno). Shared logic is in `_shared/`, for example garage registration, gateway deployments, pricing, credits and terms. |
| `supabase/migrations/` | The database schema, with row-level security on every table. |
| `tests/` | `bun test`: edge-function logic, data rules and security checks. |

## Run it locally

```sh
npm install
npm run dev
```

The app reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PUBLISHABLE_KEY`
from `.env`. These are public values: the browser receives them anyway, and the database is
protected by row-level security, not by keeping them secret. Server-side secrets (the gateway key,
Stripe and the LiteLLM master key) live only in the edge functions' environment and never in this
repository.

## How it is built

The app is developed with [Lovable](https://lovable.dev), which syncs with this repository both
ways. The backend is Supabase.

## Security

Report a vulnerability as described in the main repository's
[SECURITY.md](https://github.com/magnusfroste/garageai/blob/main/docs/SECURITY.md).

Made in Sweden by Liteit AB, built for Europe.
