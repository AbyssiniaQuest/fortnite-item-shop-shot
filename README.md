# Shop Shot

An unofficial Fortnite item shop screenshot generator built with Next.js, React, TypeScript, and Tailwind CSS.

## Features

- Fetches current shop data from the open Fortnite-API.com shop endpoint.
- Caches shop data in the Next.js route handler for 15 minutes.
- Organizes items into skins, emotes, pickaxes, kicks, bundles, gliders, wraps, back blings, jam tracks/music, and uncategorized groups.
- Shows item name, type, image, rarity, V-Bucks price, and Birr purchase-cost estimate.
- Lets you screenshot all categories together or choose a single category such as only skins or only pickaxes from a top toolbar dropdown.
- Filters the screenshot by item name/type, rarity, and season.
- Uses an editable V-Bucks-to-Birr rate. The default is `1 V-Buck = 1 Birr`.
- Provides a screenshot-mode layout designed for export.
- Downloads the filtered shop as one, two, or three PNG files.
- Uses a dark, mobile-friendly UI.
- Includes a clear unofficial fan-made disclaimer.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

The screenshot export uses a local image proxy route so remote shop art can be included in the generated PNG.
