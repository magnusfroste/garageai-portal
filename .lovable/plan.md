# Admin readability and semantic colour plan

## What I would change in the proposal

The table + detail sheet direction is right. The current screen confirms that identity, health, model controls, tests, and five actions compete in every row, so the main list should become a triage surface rather than an editor.

I would make these adjustments:

1. **Use one type filter, not three competing controls.** Use a segmented control with `All / Garages / Providers`; keep status as separate filter chips. This avoids the proposed `Garages / Providers / All` wording competing with the page title.
2. **Define one status precedence in a pure model function.** `Disabled → Paused → Offline → Degraded → Live`. “Needs attention” is a filter/sort group, not a sixth status. It includes offline while offered, a failed runtime/tunnel, failed offered models, missing terms, or stale heartbeat/check. The Status cell shows the primary status plus at most one concise reason.
3. **Show both price tiers.** Admin edits four prices today, so a single “pool in/out” line would hide dedicated pricing. The compact cell should use two tabular lines: `Pool in/out` and `Direct in/out`; the sheet remains the editing location.
4. **Use the newest relevant signal for Last seen.** Mesh garages use the newer of heartbeat and gateway check; providers use gateway check. The absolute timestamp appears in a tooltip.
5. **Keep row click for details, but preserve explicit controls.** Clicking a non-interactive part of a row opens the sheet; the overflow menu and links stop propagation. Rows also support keyboard activation.
6. **Do not hide operational IP/host data from admins.** Mesh IP, endpoint host, override, runtime, and port belong only in the private Connection section, never the compact row or public views.
7. **Do not force overflow menus where there is only one action.** Users currently have one edit action; a visible icon is faster than opening a menu. Model enable/default switches also remain direct controls. Overflow menus are for Garage rows and any future row with multiple secondary commands.
8. **Switch `--primary` to cyan app-wide, not only inside Admin.** Root primary currently drives default buttons, links, switches, focus rings, and 60+ usages, while the catalogue already locally maps primary to cyan. A scoped Admin override would preserve the brand split. I would update the root interaction token and its gradients/shadows together, then verify public and signed-in screens. Cyan remains interactive only; it is not reused for “healthy.”
9. **Use semantic status tokens, not raw Tailwind colours.** Add success, warning, danger, and neutral foreground/surface/border roles with AA-checked dark-theme pairs. Grade A/B may use two intensities of the success family, but the letter remains the primary differentiator.

## Garage page structure

### Main list

- Header actions: Refresh, Add provider, Add garage.
- Controls: search; status chips `All / Needs attention / Live / Paused / Disabled`; segmented type control `All / Garages / Providers`.
- Desktop fixed columns:
  - Status and one reason
  - Garage identity, type icon, flag/country
  - Live models (`live / offered`)
  - Grade and availability
  - Pool and direct prices
  - Last seen
  - Overflow actions
- Default order: needs-attention severity, then live, then paused/disabled; stable secondary sort by last seen and name.
- Mobile at 390 px: compact cards showing status/reason, identity/location, model count, grade/availability, and overflow menu. Selecting a card opens a full-screen sheet.
- Loading, error, empty-search, and no-garages states remain actionable.

### Detail sheet

A wide right sheet on desktop and full-screen sheet on mobile, with a sticky identity header and independently scrollable body:

1. **Health** — tunnel, runtime, models; explicit words and reasons; latest check timestamps.
2. **Models** — canonical name, runtime ID where admin-aliased, installed/offered controls, private state, aliases, latest acceptance result, tok/s, TTFT, and tools result.
3. **Connection** — type, private mesh IP or endpoint host, API host override, runtime/port, heartbeat, gateway check, registration time.
4. **Owner & terms** — operator email, accepted/missing state, version and acceptance date.
5. **Location** — effective country, measured/declared/override values, location display mode, and recent-change warning; editing stays here.
6. **Pricing** — all four current prices with the existing price-history-safe save flow.
7. **Revenue** — this-month requests, failures, tokens, revenue, fee, and payable from the existing revenue aggregate. If that aggregate is unavailable, show a retryable section error without blocking the sheet.

All existing destructive confirmations and one-time credential/key dialogs remain intact; the menu only launches them.

## Component plan

### Shared presentation primitives

- `StatusBadge` — icon/dot, explicit label, semantic tone, compact/default sizes.
- `StatusReason` — one-line reason with tooltip for the complete error.
- Semantic `Badge` variants: success, warning, danger, neutral.
- Shared numeric/meta classes: tabular values and one 12 px muted metadata style.

### Garage admin components

- `GaragePanel` — orchestration only: queries, mutations, dialogs, selected garage, and page-level controls.
- `GarageTable` — desktop table and sorting/filtering output.
- `GarageMobileList` — compact 390 px cards.
- `GarageStatusCell` — status, reason, and stale-signal treatment.
- `GarageIdentityCell` — mono name, display name, type icon, and location.
- `GaragePriceCell` — pool/direct in/out values.
- `GarageActionsMenu` — prices, retest, command/key, enable/disable, delete.
- `GarageDetailSheet` — section layout and responsive sheet behavior.
- `GarageHealthSection`, `GarageModelsSection`, `GarageConnectionSection`, `GarageOwnerTermsSection`, `GarageLocationSection`, `GaragePricingSection`, `GarageRevenueSection` — focused section components.
- `adminGaragePresentation` service — derives status/reason, attention severity, model counts, last-seen timestamp, filters, and stable sort. This keeps business presentation rules out of the view and makes them unit-testable.

No database migration or new backend endpoint is planned: the requested fields are already available through the current garage, model-test, reliability/location, and revenue reads. Revenue will reuse the existing aggregate rather than joining spend into the garage query.

## Other admin panels

### Touch now

- **Users:** fixed numeric columns, tabular values, semantic remaining-credit state, consistent metadata; retain the direct edit icon because it is the only row action.
- **Catalogue:** replace colour-only dots with status word + semantic badge; use a compact fixed-column desktop table and mobile rows; keep enable/default controls visible, with secondary link editing grouped cleanly.
- **Revenue:** move to the shared table styling, align numeric columns, preserve CSV and period controls; no row action menu because rows have no actions.
- **Credits/key overview inside Users:** semantic active/revoked states, tabular values, consistent table density and empty/loading/error states.

### Leave unchanged

- **Settings, Website settings, proxy, and payment configuration:** these are form/card workflows rather than scan-heavy record lists; applying table or overflow-menu patterns would not improve them.
- **Usage summary:** only normalize token colours/typography where inherited; do not restructure charts or data in this pass.

## Files

### Existing files to update

- `src/index.css`
- `tailwind.config.ts`
- `src/components/ui/badge.tsx`
- `src/components/ui/sheet.tsx` (responsive width/full-screen variant only)
- `src/views/Admin/components/GaragePanel.tsx`
- `src/views/Admin/hooks/useGarages.ts`
- `src/views/Admin/components/EditGaragePrices.tsx`
- `src/views/Admin/components/GarageCountryEditor.tsx`
- `src/views/Admin/components/UserTable.tsx`
- `src/views/Admin/components/ModelCurationPanel.tsx`
- `src/views/Admin/components/RevenuePanel.tsx`
- `src/views/Admin/components/CreditOverviewPanel.tsx`
- `src/views/Admin/components/ApiKeyOverviewPanel.tsx`
- `src/views/Garages/components/Reliability.tsx`
- `src/views/Garages/components/GarageHealth.tsx`
- `src/i18n/sv.ts`
- `AGENTS.md` (record the shared presentation-model boundary)

### New focused files

- `src/components/ui/status-badge.tsx`
- `src/models/services/adminGaragePresentation.ts`
- `src/models/services/adminGaragePresentation.test.ts`
- `src/views/Admin/components/garages/GarageTable.tsx`
- `src/views/Admin/components/garages/GarageMobileList.tsx`
- `src/views/Admin/components/garages/GarageStatusCell.tsx`
- `src/views/Admin/components/garages/GarageIdentityCell.tsx`
- `src/views/Admin/components/garages/GaragePriceCell.tsx`
- `src/views/Admin/components/garages/GarageActionsMenu.tsx`
- `src/views/Admin/components/garages/GarageDetailSheet.tsx`
- `src/views/Admin/components/garages/GarageDetailSections.tsx`

The final split may combine very small cells, but `GaragePanel.tsx` will no longer own row rendering, status derivation, and all edit surfaces together.

## Verification

- Unit tests for status precedence, attention reasons, live/offered counts, last-seen selection, filtering, and stable sorting.
- Interaction checks for row/sheet keyboard use, menu actions, destructive confirmation, model toggles, alias editing, price save, country save, retest, and command/key dialogs.
- Visual checks at 1280 px and 390 px for Garages, Users, Catalogue, Revenue, and Credits overview; no horizontal page overflow, clipped menus, or hidden sheet controls.
- Contrast checks for every semantic badge/text pair at WCAG AA, plus focus-visible checks.
- Regression screenshots for catalogue, dashboard, chat, API keys, credits, models, and public garage pages after the app-wide cyan primary switch.

## Credit estimate

**Estimated implementation: 12–16 Lovable credits.**

- 7–9 credits: Garage table, responsive cards, presentation service, actions, and detail sheet.
- 2–3 credits: semantic tokens, cyan primary migration, badge/grade cleanup.
- 2–3 credits: cheap consistency pass across Users, Catalogue, Revenue, and Credits/key overview.
- 1 credit: tests, contrast review, and desktop/mobile regression verification.

The estimate assumes no backend/schema changes. If the existing revenue aggregate cannot be reused efficiently per sheet, defer that section rather than adding backend scope silently.
