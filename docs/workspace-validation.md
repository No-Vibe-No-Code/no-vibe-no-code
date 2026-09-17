# Member workspace validation

## Local checks — 2026-09-17

- `npm run check`: browser bundles and Cloudflare Worker dry run passed.
- `npm run test:workspace`: **198 assertions passed** against an isolated local
  D1 database and R2 bucket, with owner, administrator, ordinary member,
  outsider, and staff fixtures. No production records were used for these tests.
- Covered totals beyond one page, stable timestamp/ID and name/ID pagination,
  search/filters, partial and concurrent preference updates, pin ordering,
  Markdown rendering, public/private/unpublished access, image validation and
  removal, staff review, project archive-to-Draft restoration, team roles,
  ownership transfer, invitation cancellation/expiry/reissue, returning members,
  concurrent acceptance, notification categories, individual/bulk actions, and
  compatibility read endpoints.

## Interactive browser checks

Tests used the real forms, links, file picker, dialogs, and buttons in the
Codex browser against `localhost:8791`:

- Project creation, Markdown preview, team association, cover upload, editing,
  save confirmation, review submission, archive, and restore to Draft.
- Rejected a non-HTTP demo link without losing entered text; corrected and saved
  it successfully.
- Team creation, introduction editing, avatar upload, archive/restore, member
  search/invitation, and administrator-to-member role change.
- Recipient accepted an invitation in Notifications. Resolved and expired
  invitations displayed their state without active acceptance controls.
- Ordinary members saw read-only team settings and could leave. Administrators
  could edit details but did not receive ownership-transfer or archive controls.
  Transfer, removal, and all role boundaries were additionally verified by API.
- Notification read/unread, save, bulk Done/Restore, and immediate unread badges.
- Team list/grid and pins persisted after reload and a fresh collection URL.
- Team-tab Back/Forward, old Home team URLs, legacy `project.html` redirects,
  public gallery/profile/project access, and protected-page sign-in return paths.
- Keyboard-visible focus, working Skip to content, and zero-duration transitions
  with `prefers-reduced-motion: reduce`.

## Responsive inspection

Inspected screenshots at **1440, 768, 390, and 320 CSS pixels**. Verified a
single-column mobile layout, scrolling navigation, readable filters, no
page-level horizontal overflow on the checked pages, and a footer in normal
document flow. No persistent mascot or bottom navigation obscures the content.

| Width | Representative checks |
| --- | --- |
| 1440 | Home, project editor/detail/settings, Teams, desktop notification pane |
| 768 | Team list and access-filtered team project list |
| 390 | Notification detail/actions, public gallery, Members, loaded profile |
| 320 | Home, project filters/list/detail, notification detail, keyboard navigation |

Reviewed captures (synthetic local fixtures, not real member data):

- [Desktop Home](screenshots/workspace/home-desktop.png)
- [Tablet team projects](screenshots/workspace/team-tablet.png)
- [Mobile notification detail](screenshots/workspace/notifications-mobile.png)
- [Narrow project detail](screenshots/workspace/project-narrow.png)

The existing GitHub README-specific CSS and sanitizer were retained. The shared
shell changes surrounding navigation/footer, not imported README sizing rules.

## Rollout

- Applied `0009_member_workspace.sql` to remote D1 successfully. A subsequent
  migration listing reports no pending migrations.
- Deployed through the existing `npm run deploy` Cloudflare workflow.
  Final Worker version: `90b3e993-4a96-4d52-aee9-f763cdd70c7e`.
- Verified `https://novibenocode.ccwu.cc`: all nine workspace/public entry pages
  return the shared shell. The CSS and new JavaScript bundles match local build
  hashes. Protected APIs return 401 to visitors, and the public project query
  succeeds against the migrated schema.
- Live `/projects` preserves its destination through sign-in. The live public
  gallery and profile render normally; all 36 images in the existing imported
  GitHub README loaded, retaining the intended two-column desktop arrangement.
- Live 320px inspection caught a wrapping footer link. Reduced the narrow-screen
  gap, bumped the stylesheet version, and reverified all five footer links on
  one row with no horizontal overflow. Shared script versions were updated on
  legacy pages as well.
- The closed Cloud Cat vote remains unchanged. No test accounts, projects,
  invitations, or notifications were created in production.

Implementation and release notes are committed locally. No Git push was part
of this rollout.
