# Shop Shot

An unofficial Fortnite item shop screenshot generator built with Next.js, React, TypeScript, and Tailwind CSS.

## Features

- Fetches current shop data from the open Fortnite-API.com shop endpoint.
- Caches the API response once per UTC shop day. GitHub Pages builds after reset at 00:05 UTC; open generators check the published shop at 00:20 UTC. Failed or delayed publication is retried with backoff up to 30 minutes until today's shop arrives. Successful shops are not polled.
- Organizes items into skins, emotes, pickaxes, kicks, bundles, gliders, wraps, back blings, jam tracks/music, and uncategorized groups.
- Shows item name, type, image, rarity, V-Bucks price, and Birr purchase-cost estimate.
- Lets you screenshot all categories together or choose multiple categories such as skins plus pickaxes from a top toolbar multi-select.
- Filters the screenshot by item name/type, rarity, and season.
- Uses an editable V-Bucks-to-Birr rate. The default is `1 V-Buck = 1 Birr`.
- Provides a screenshot-mode layout designed for export.
- Downloads the filtered shop as one, two, or three PNG files.
- Supports scheduled Telegram posting with an on/off switch, a 1-30 day interval, and an editable `{date}` caption.
- Uses a dark, mobile-friendly UI.
- Includes a clear unofficial fan-made disclaimer.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Run `node scripts/update-shop-data.mjs` before the first local preview. The daily build verifies every item image and publishes 256px previews and 768px export artwork as same-origin WebP assets. GitHub Actions caches artwork and the daily API payload. A failed image stops publication, preserving the previous working shop.

The export renderer decodes four images at a time, retries failures, and never downloads a PNG containing placeholder initials. Downloads include persistent save links and one-, two-, or three-file splitting along complete item rows. High and Ultra target 2160px and 3240px widths; very tall PNGs are scaled within a 24-megapixel/16384px canvas budget. Split a long shop to retain larger, clearer items.

Fortnite refreshes around 00:00 UTC (03:00 in Ethiopia and Nairobi), according to [Epic Games](https://www.epicgames.com/help/c-34254770/c-33726977/a21140200). GitHub's scheduled runs can be delayed, so exact publication at a wall-clock minute is not guaranteed. The UI shows the shop date and keeps the last available shop visible during a failed refresh.

## Verification

Build the GitHub Pages export with `GITHUB_PAGES=true` and `NEXT_PUBLIC_BASE_PATH=/fortnite-item-shop-shot`, then run `npm run test:generator` and `npm run test:live`. The generator checks real PNG output, image-failure recovery, daily caching, split downloads, category controls, and mobile columns. Screenshots and PNG samples are written to `.test-output/`.

## Telegram auto posting

Add these repository Actions secrets before enabling automatic posting:

- `TELEGRAM_BOT_TOKEN`: token created by BotFather.
- `TELEGRAM_CHAT_ID`: target chat ID or channel username such as `@channelname`.

The bot must be an administrator of the target channel. Auto posting runs from GitHub Actions at approximately 7:00 AM in the Africa/Nairobi timezone. The website's **Auto posting** panel creates an owner-confirmed GitHub settings issue, which is applied and closed automatically.
