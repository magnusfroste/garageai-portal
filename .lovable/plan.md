# Public garages aligned with the catalogue

- Reuse the catalogue’s location, provider, grade and two-metric displays on garage cards and profile headers.
- Show canonical offered-model links (four chips and a remaining count), private-model badges, public engine labels, and Live / Paused / Offline status.
- Add the shared EU/EEA filter with URL and saved preference, plus Grade / Availability / Name sorting with live garages first.
- Exclude admin-disabled garages and garages with neither live history nor offered models.
- Verify anonymously at desktop and mobile sizes, including model links, profile navigation, sorting, filtering and the measurement popover.

## Technical details

- Keep data access in repositories, composition/filtering in a service, querying in a hook, and presentation in shared view components.
- Use the existing public RPCs: `garage_public_stats`, `garage_public_locations`, `garage_public_models`, `garage_public_providers`, `garage_reliability`, and `garage_profile` for profile history.
- Extend public stats with safe display/status/history metadata; remove runtime model IDs from `garage_profile` by returning canonical offered models instead. Retain explicit anonymous execution grants.
- Do not change routing, prices, acceptance tests or reliability calculations.

## Verified cause

`laptop-gpu-1np5` is admin-disabled with no offered models. The old page lists every reliability result without checking disabled status; the updated list will exclude it.
