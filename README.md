# Smart Grocery Tracker (MVP)

A working full-stack MVP that lets users:

- Sign up / sign in.
- Upload receipt images (with optional mock structured payload for accurate extraction).
- Auto-populate pantry inventory and expiry tracking.
- Log consumption.
- Get low-stock and weekly reorder recommendations.

## Why this implementation

You asked to "do complete project". This repository now contains a runnable MVP backend + web UI, not only planning docs.

## Tech stack

- Node.js + Express API
- SQLite (`better-sqlite3`) for local persistence
- JWT auth
- Multer file uploads for receipt images
- Static HTML/JS UI for quick end-to-end usage

## Quick start

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## API overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Receipts
- `POST /api/receipts/upload` (multipart form-data)
  - `receipt`: file (required)
  - `mockPayload`: JSON string (optional)

`mockPayload` example:

```json
{
  "merchant": "Walmart",
  "purchased_at": "2026-04-15T09:00:00.000Z",
  "items": [
    { "name": "Milk", "quantity": 1, "unit": "count", "price": 3.5 },
    { "name": "Bananas", "quantity": 6, "unit": "count", "price": 2.4 }
  ]
}
```

### Pantry
- `GET /api/pantry`
- `POST /api/pantry/consume`

### Recommendations
- `GET /api/recommendations`

## Project structure

- `src/server.js` - API routes and application bootstrapping
- `src/db.js` - SQLite schema and initialization
- `src/auth.js` - JWT creation + auth middleware
- `src/receiptParser.js` - mock payload parser + fallback extraction
- `src/recommendations.js` - pantry summary + demand prediction logic
- `public/index.html` - lightweight end-to-end UI

## Notes on store integrations (Walmart/Instacart/Kroger)

Direct integrations vary by retailer. In production you should prioritize official APIs/OAuth. This MVP focuses on core inventory intelligence and receipt workflows first, with extension points ready in the API layer.


## Detailed setup

For exact end-to-end setup and copy/paste API commands, see `docs/setup-guide.md`.
