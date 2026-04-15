# Smart Grocery Tracker: Step-by-Step Setup Guide

This guide gives you exact commands and exact request payloads to run the app locally.

## 1) Prerequisites

Install these first:

1. **Node.js 20+**
2. **npm 10+**
3. (Optional) **Postman** or **curl** for API testing

Check versions:

```bash
node -v
npm -v
```

## 2) Get the project

```bash
git clone <your-repo-url>
cd test
```

If you already have the repo:

```bash
git pull
```

## 3) Install dependencies

```bash
npm install
```

If your environment blocks npm registry access (403), run in a normal local machine/network or configure your npm proxy/registry policy.

## 4) Configure environment (recommended)

Create `.env` in project root:

```env
PORT=3000
JWT_SECRET=change-this-to-a-long-random-secret
```

> `JWT_SECRET` must be changed from default in real usage.

## 5) Start the app

Development mode (auto reload):

```bash
npm run dev
```

Production-style run:

```bash
npm start
```

Open the UI at:

- `http://localhost:3000`

Health check:

```bash
curl http://localhost:3000/api/health
```

Expected:

```json
{"status":"ok","service":"smart-grocery-tracker"}
```

## 6) Use the app from browser (fastest)

1. Open `http://localhost:3000`.
2. Register with name/email/password.
3. Login.
4. Upload a receipt file.
5. (Optional but recommended) provide `mockPayload` JSON in the textarea so parsed items are accurate.
6. Click **Refresh Pantry & Predictions**.
7. Use **Consume Pantry Item** with an item id and amount.

## 7) Use the app via API (exact curl flow)

### 7.1 Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","email":"alex@example.com","password":"Pass123!"}'
```

Copy `token` from response.

### 7.2 Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"Pass123!"}'
```

### 7.3 Upload receipt

Create a sample payload file `payload.json`:

```json
{
  "merchant": "Walmart",
  "purchased_at": "2026-04-15T09:00:00.000Z",
  "items": [
    {"name": "Milk", "quantity": 1, "unit": "count", "price": 3.5},
    {"name": "Bananas", "quantity": 6, "unit": "count", "price": 2.4},
    {"name": "Eggs", "quantity": 1, "unit": "count", "price": 4.9}
  ]
}
```

Then upload:

```bash
TOKEN="<paste-token-here>"

curl -X POST http://localhost:3000/api/receipts/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "receipt=@/full/path/to/receipt.jpg" \
  -F "mockPayload=$(cat payload.json)"
```

### 7.4 Read pantry summary

```bash
curl http://localhost:3000/api/pantry \
  -H "Authorization: Bearer $TOKEN"
```

### 7.5 Log consumption

Use an id from pantry response:

```bash
curl -X POST http://localhost:3000/api/pantry/consume \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pantry_item_id":1,"amount":0.5}'
```

### 7.6 Get recommendations

```bash
curl http://localhost:3000/api/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

## 8) Exact data behavior you should expect

1. **Receipt upload** creates:
   - one row in `receipts`
   - many rows in `receipt_items`
   - upsert/merge rows in `pantry_items`
2. **Expiry dates** are estimated by item keyword rules in `src/receiptParser.js`.
3. **Pantry summary** returns:
   - `expired`
   - `expiring_soon`
   - `use_first`
4. **Recommendations** return:
   - `low_stock` (quantity `<= 1`)
   - `predictions` from last 7 days usage

## 9) Run tests

```bash
npm test
```

Current automated coverage includes:
- receipt payload normalization + validation errors
- pantry expiry/summary behavior
- prediction behavior for both reorder-needed and stock-sufficient scenarios

## 10) Troubleshooting

### `npm install` fails with 403
- Cause: network/security policy blocks npm registry.
- Fix: run on local machine with open npm access, or configure your org proxy/allow-list.

### `Missing bearer token`
- Cause: Authorization header missing.
- Fix: add `-H "Authorization: Bearer $TOKEN"`.

### `Invalid JSON in mock receipt payload`
- Cause: malformed JSON in `mockPayload`.
- Fix: validate JSON first or use `payload.json` file + `$(cat payload.json)`.

### `Not enough quantity in stock`
- Cause: consume amount exceeds pantry quantity.
- Fix: consume a smaller amount.

## 11) What to do next for production

1. Replace mock extraction with real OCR/vision.
2. Move from local SQLite to managed Postgres.
3. Add encrypted secret management and rotate JWT secrets.
4. Add retailer OAuth/API integrations.
5. Add background jobs for sync + predictions.
