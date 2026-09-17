# Admin workspace validation — 2026-09-17

## Local checks

- `npm run check`: browser assets built and Worker deployment dry-run passed.
- `npm run test:admin`: 110 assertions passed against an isolated local D1/R2
  fixture, including all eight routes, exact totals beyond one page, staff
  permissions, form audience/time enforcement, published versus draft revisions,
  response review and CSV, project review, team interventions and invitations,
  contact triage, competition settings, NFC issuance/disable, and scheduled
  broadcast processing and retry without duplicate per-recipient deliveries.
- `npm run test:workspace`: existing 198 member-workspace assertions passed.
- Local browser: signed in with fixture staff and non-staff accounts. Direct
  links preserved the requested destination after sign-in; the non-staff
  account received a clear access-denied page. The form preview showed distinct
  saved and live revisions. `/admin.html#forms` redirected through sign-in to
  `/admin/forms`. Mobile navigation opened and dismissed with Escape.
- Visually inspected actual browser screenshots at 1440px (Members), 768px
  (Form builder), 390px (Broadcasts and form revision previews), and 320px
  (Project review). Checked all eight collection pages at all four widths:
  each rendered without an error or horizontal document overflow. The member
  detail action panel was corrected to stay in its sidebar on desktop; closed
  mobile navigation no longer stays keyboard-focusable.

The fixture is disposable local data, not production. `tests/admin.mjs --serve`
starts it on port 8793 and prints the temporary storage directory. No fixture
accounts or generated NFC token URLs should be copied into production or docs.

## Rollout checks

- Applied `0010_admin_workspace.sql` locally in the fixture and remotely before
  Worker deployment. The remote migration list then reported no pending work.
- Deployed the Worker and five changed assets through `npm run deploy`. Wrangler
  reported the custom domain and the `* * * * *` scheduled trigger.
- Verified the live custom domain returned HTTP 200 for all eight admin routes.
  Unauthenticated requests to `/api/admin/dashboard` and
  `/api/admin/nfc-cards` returned HTTP 401. Opening `/admin` in a fresh live
  browser tab reached sign-in with `returnTo=/admin`.
- Authenticated live staff behavior is **not yet verified**: no production
  staff credentials were used in this run. Local role fixtures and denied
  actions passed, but a real staff session remains the final acceptance check.
