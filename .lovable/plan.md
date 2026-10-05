# Plan: Security completion and UX trust fixes

## Goal
Finish the pending routing, payment, and security review before updating privacy language, onboarding, chat, documentation, navigation, and model reliability presentation in English and Swedish.

## Implementation
- Complete garage routing reconciliation so only healthy, tested, enabled models exist in gateway routing; store runtime keys securely and cover all models over recurring probes.
- Harden registration model names, connect commands, rendering origins, platform-chat accounting, user repair, budgets, and Stripe credit processing.
- Replace inaccurate privacy claims with the approved disclosure across landing, API guidance, settings defaults, and chat.
- Remove English-interface Swedish leftovers, rename catalogue query parameters while retaining old aliases, and standardize examples and links.
- Make garage suggestions anonymous and warn when reissuing credentials for an existing garage.
- Auto-create a normal-budget “Chat” key on first send, surface failures inline, and preserve keyboard submission behavior.
- Correct signup tab selection, configured starting-credit display, and email-confirmation state.
- Ensure documentation defaults to the configured pool default model and production gateway; restrict default-star controls to pool rows.
- Add logged-out mobile navigation and improve model pages with pool/specific options, public signup CTA, and honest reliability periods.

## Technical details
- Preserve repositories → services/models → hooks → views separation and route all user-facing strings through `t()` with Swedish entries.
- Use one shared idempotent credit claim path for browser verification and Stripe webhook processing.
- Keep gateway admin calls server-side with the existing master key and never expose runtime keys or prompts.
- Deploy affected functions and migrations, then verify the requested routing/security cases plus desktop and mobile UX.

## Verification
- Confirm preview build and runtime logs are clean.
- Test model-name rejection, model removal/recreation in gateway routing, Sync models, payment idempotency, and user repair paths.
- Test signup states, keyless first chat, catalogue aliases, mobile menu, documentation defaults, and model-page reliability labels.
