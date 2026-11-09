# Chat-first onboarding

- Send new buyers and “Both – show me around” directly to Auto Chat. Claim an account-persisted first-answer flag before sending the existing prompt, so later visits do not resend it.
- Replace the key-first entry with a small dismissible Chat line linking to the existing API setup; retain the show-once key in the signed-in layout and preserve `?manage=1`.
- Offer Chat, private remote access, and community sharing as three starting paths, with the supplied English wording and Swedish translations.
- Keep one Bridge install flow: the Bridge link does not carry visibility. Ask “Only me / Me and the market” on the approval page and save access before releasing credentials. Existing re-links retain their access unless explicitly changed.
- Exclude operator intent from the 30-day buyer funnel, include the earliest saved conversation or API request as first use, and add aggregate `chatted` and `first_use` counts without exposing new identities.
- Keep billing, pricing, credits displays, terms and local-first chat privacy unchanged. Saved-chat counts remain limited to accounts that opted into sync.

## Technical details
- Preserve repository → service → hook → view boundaries. Reuse account auth metadata for the consumed onboarding prompt and existing garage visibility fields.
- Add focused rule tests, run the full Bun suite, check desktop/mobile flows, deploy only changed functions (`ops-summary`, and approval if necessary), then publish.