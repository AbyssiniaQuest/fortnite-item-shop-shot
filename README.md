# Shop Shot

An unofficial Fortnite item shop screenshot generator built with Next.js, React, TypeScript, and Tailwind CSS.

## Features

- Fetches current shop data from the open Fortnite-API.com shop endpoint.
- Caches shop data in the Next.js route handler for 15 minutes.
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

The screenshot export uses a local image proxy route so remote shop art can be included in the generated PNG.

## Telegram auto posting

Add these repository Actions secrets before enabling automatic posting:

- `TELEGRAM_BOT_TOKEN`: token created by BotFather.
- `TELEGRAM_CHAT_ID`: target chat ID or channel username such as `@channelname`.

The bot must be an administrator of the target channel. Auto posting runs from GitHub Actions at approximately 7:00 AM in the Africa/Nairobi timezone. The website's **Auto posting** panel creates an owner-confirmed GitHub settings issue, which is applied and closed automatically.
