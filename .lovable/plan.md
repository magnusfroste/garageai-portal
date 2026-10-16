# Real demand and new-account next steps

## Changes
- Mark gateway, acceptance-test and test/probe/ops-alias keys as internal, with admin-only changes to that flag.
- Exclude internal traffic from all customer demand, popularity, recommendations, Smart and owner request figures. Preserve internal statistics for Admin and do not change price-based pool weighting.
- Show both starting paths on first sign-in: API key or auto chat, and GPU connection with the existing install command and OS choices. Keep English and Swedish text.
- Add tests for internal-only zero demand and welcome eligibility: at least 10 minutes old, no key ever created, no garage linked, only once.

## Email prerequisite
No sender domain is configured. Sending the welcome notice requires setting up a domain you own. Prepare the eligibility logic now; connect the actual send and scheduler after domain setup. Email cannot contain interactive OS tabs; show static OS choices or link to the connection page.

## Technical approach
Keep repositories, services, hooks and views separate. Filter before demand aggregation, identify gateway keys without exposing credentials, protect internal metadata server-side, and use the existing email infrastructure once available. Verify affected rules and first-sign-in views before reporting completion.