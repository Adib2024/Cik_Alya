# Cik Alya

Tooling for Cik Alya's affiliate content. Social posting and scheduling go through
[Zernio](https://zernio.com) (`@zernio/node` SDK).

## Setup

Requires Node.js 22.9+.

```bash
npm install
cp .env.example .env   # then put your ZERNIO_API_KEY in .env (never commit it)
```

Connect social accounts (Instagram, TikTok, Threads, …) in the Zernio dashboard first.

## Usage

```bash
# Read-only: show connected accounts and their ids
npm run zernio -- accounts

# Upload a local image/video and get a public URL
npm run zernio -- upload ./media/photo.jpg

# Save a draft (no --at / --now = draft; nothing goes live)
npm run zernio -- post --content "New find! Link in bio" --to instagram --media ./media/photo.jpg

# Schedule
npm run zernio -- post --content "..." --to instagram --media ./media/photo.jpg \
  --at 2026-12-01T20:00:00+08:00 --tz Asia/Kuala_Lumpur

# Publish immediately
npm run zernio -- post --content "..." --to threads --now

# Bulk-schedule from a file (validate first with --dry-run)
npm run zernio -- bulk examples/posts.example.json --dry-run
npm run zernio -- bulk examples/posts.example.csv
```

`--to` accepts a platform name (`instagram`), a username (`@miss_cikalya`) or an
account id, and can be repeated. Without it, the post targets every active account.

### Batch file formats

- **JSON**: an array of `{ content, targets, media, scheduledFor, timezone, hashtags, title }`.
  See `examples/posts.example.json`.
- **CSV**: header `content,scheduledFor,targets,media,timezone,hashtags`; separate list
  values with `|`. See `examples/posts.example.csv`.

`media` entries can be public `https://` URLs or local paths (relative to the batch
file). Local files are uploaded through Zernio's presigned upload (up to 5 GB).
Past `scheduledFor` times and unknown targets are rejected before anything is created.

Platform notes: Instagram and TikTok posts need media, and Instagram needs a Business
account. Full API reference: <https://zernio.com/llms.txt>.

## Image cards

Render a branded 1080x1350 card (kinds: isu, market, kewangan, edukasi, santai) and
optionally upload it to Zernio. It prints the public URL to use in `--media`:

```bash
npm run card -- --kind market --title "KLCI naik 0.8%" --subtitle "Penutupan Jumaat" --out card.png --upload
```

Needs Playwright with Chromium installed.

## Using it in code

```ts
import { listAccounts, createPost } from "./src/zernio.js";

const accounts = await listAccounts();
await createPost({
  content: "Hello from Cik Alya",
  targets: ["instagram"],
  media: ["./media/photo.jpg"],
  scheduledFor: "2026-12-01T20:00:00+08:00",
});
```

## Running behind a proxy (e.g. Claude Code cloud sessions)

Node's built-in `fetch` ignores `HTTPS_PROXY` unless told otherwise:

```bash
NODE_USE_ENV_PROXY=1 ZERNIO_API_KEY=proxy-injected npm run zernio -- accounts
```
