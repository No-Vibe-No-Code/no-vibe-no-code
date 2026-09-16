# No Vibe No Code

A bilingual website and member portal for a student-led AI maker club. Members
can create public profiles, share projects, join teams, and claim NFC profile
cards. Club leaders manage accounts, forms, projects, and card issuance.

[Visit the live site](https://novibenocode.ccwu.cc)

![No Vibe No Code homepage](docs/screenshots/home.png)

## Current member experience

- Create an account and edit a public profile at `/profile.html?edit=1`. The
  owner can upload a PNG, JPG, or WebP photo under 2 MB, write a bio and README,
  add public links, and choose which contact details to publish.
- Import a public GitHub profile README from the matching
  `username/username` repository. The last successful import remains visible
  if GitHub is temporarily unavailable. Members can also publish a local README.
- Claim a card on its first `/nfc/<token>` scan after signing in or creating an
  account. Later scans open the owner's public profile by default. The owner
  can set or clear a separate HTTP(S) destination for each claimed card under
  **Edit profile → My NFC cards**. Card tokens stay on the physical card and
  are not returned by the profile settings API.
- View the closed card-design vote at `/vote`. Cloud Cat won with the highest
  average rating. The page displays the selected front and back art and final
  participation totals; new ratings are rejected by the API.
- Visit `/chart` for a separate site redirect to the linked YouTube video.

The selected card artwork is stored at
[`public/card-variants/cloud-cat-front.png`](public/card-variants/cloud-cat-front.png)
and [`public/card-variants/cloud-cat-back.png`](public/card-variants/cloud-cat-back.png).
These are the original supplied PNGs, without cropping or recompression.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Semantic HTML, modern CSS, vanilla JavaScript |
| Runtime and static assets | Cloudflare Workers |
| Database | Cloudflare D1 |
| Profile photos | Cloudflare R2 |
| Authentication | PBKDF2-SHA-256 passwords, secure HTTP-only session cookies |
| Build and deployment | TypeScript, esbuild, Wrangler, npm |

The Worker in `src/index.ts` handles API routing and friendly site routes.
`src/workspace.ts` implements member, project, vote-result, and NFC APIs.
`src/github.ts` imports and sanitizes public GitHub README content. Static
pages and browser scripts live in `public/`; schema changes live in
`migrations/`.

## NFC and vote APIs

| Route | Purpose |
| --- | --- |
| `GET /api/nfc/cards/<token>` | Check a card and record a scan |
| `POST /api/nfc/cards/<token>/claim` | Bind an unclaimed card to the signed-in member |
| `GET /api/nfc/my-cards` | List the signed-in member's claimed cards without their tokens |
| `PUT /api/nfc/my-cards/<id>` | Set `redirectUrl` to an HTTP(S) URL, or `""` for the profile default |
| `GET /api/vote/results` | Public final ratings and selected winner |
| `POST /api/vote` | Returns HTTP 410 because the vote is closed |

`migrations/0008_nfc_redirects.sql` adds the per-card destination. Existing
cards keep the profile default until their owners choose another link. Do not
put generated NFC token URLs in Git, logs, screenshots, or public documents.

## Local development

Requires Node.js 20 or newer, npm, and Wrangler access to the configured
Cloudflare account for deployment.

```bash
npm install
npx wrangler d1 migrations apply no-vibe-no-code --local
npm run dev
```

Wrangler normally serves the site at `http://localhost:8787`. Build the
browser scripts and dry-run the Worker bundle with:

```bash
npm run check
```

For a new Cloudflare account, create the D1 database and R2 bucket named in
`wrangler.toml`, update the D1 database ID, and configure the initial leader
secrets. Apply all migrations before deploying:

```bash
npx wrangler d1 migrations apply no-vibe-no-code --remote
npm run deploy
```

The deployment script builds the browser assets before publishing. The
Wrangler configuration targets `novibenocode.ccwu.cc`. Verify the live custom
domain separately after each deployment.

## Project structure

```text
.
├── docs/screenshots/       README screenshots
├── migrations/             D1 schema migrations
├── public/                 Pages, scripts, styles, and card artwork
├── src/index.ts            Worker router and legacy account API
├── src/workspace.ts        Member, project, NFC, and vote APIs
├── src/github.ts           GitHub README import and safe rendering
├── package.json            Build and deployment scripts
└── wrangler.toml           Cloudflare bindings and custom domain
```

Released under the [MIT License](LICENSE).
