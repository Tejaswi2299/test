# Architecture Blueprint

## 1) High-level System

```text
React App (Vercel)
  ├─ Auth UI + Pantry Dashboard
  ├─ Receipt Upload
  └─ Recommendations View
        |
        v
Supabase
  ├─ Auth (users)
  ├─ Postgres (domain data)
  ├─ Storage (receipt images/files)
  └─ Edge Functions
        ├─ receipt_ingest
        ├─ order_sync
        └─ prediction_run
```

## 2) Domain Model (initial)

### users
- `id` (uuid, pk)
- `email`
- `created_at`

### households
- `id` (uuid, pk)
- `name`
- `owner_user_id` (fk users)

### household_members
- `household_id` (fk)
- `user_id` (fk)
- `role` (`owner|member`)

### receipts
- `id` (uuid, pk)
- `household_id` (fk)
- `merchant`
- `purchase_at` (timestamp)
- `currency`
- `subtotal`, `tax`, `total`
- `source` (`upload|email|store_sync`)
- `raw_file_path`

### receipt_items
- `id` (uuid, pk)
- `receipt_id` (fk)
- `product_name_raw`
- `brand`
- `quantity`
- `unit` (e.g., `g`, `kg`, `lb`, `oz`, `count`, `ml`)
- `unit_price`
- `line_total`
- `normalized_product_id` (nullable fk)

### pantry_items
- `id` (uuid, pk)
- `household_id` (fk)
- `normalized_product_id` (nullable fk)
- `display_name`
- `qty_on_hand`
- `unit`
- `expires_at` (nullable)
- `opened_at` (nullable)
- `source_receipt_item_id` (nullable fk)

### consumption_events
- `id` (uuid, pk)
- `pantry_item_id` (fk)
- `delta_qty` (negative for usage)
- `recorded_at`
- `method` (`manual|estimated|recipe`)

### store_connections
- `id` (uuid, pk)
- `household_id` (fk)
- `provider` (`walmart|instacart|kroger|other`)
- `auth_type` (`oauth|automation`)
- `status`
- `encrypted_refresh_token` (nullable)
- `last_sync_at` (nullable)

### purchase_predictions
- `id` (uuid, pk)
- `household_id` (fk)
- `product_name`
- `recommended_qty`
- `unit`
- `prediction_for_week_of`
- `reason`

## 3) Key Workflows

### A. Receipt ingestion
1. User uploads receipt image/PDF.
2. File saved to Supabase Storage.
3. `receipt_ingest` function calls vision model to extract structured JSON.
4. Create `receipts` and `receipt_items` rows.
5. Upsert `pantry_items` quantities.
6. Return extraction confidence + user correction UI.

### B. Pantry update and expiry ranking
1. On every pantry mutation, recompute status fields:
   - `fresh` / `expiring_soon` / `expired`.
2. “Use first” list = sort by earliest non-null `expires_at`, then highest quantity.

### C. Prediction engine
1. Weekly scheduled job reads historical consumption and purchase cadence.
2. Calculates expected weekly demand by product.
3. Subtracts current `qty_on_hand`.
4. Writes recommendations into `purchase_predictions`.

## 4) API/Function Contracts

### `POST /api/receipts/extract`
Input:
- image file
- household_id

Output:
- parsed receipt metadata
- line items + confidence scores

### `POST /api/store-connections/:provider/sync`
Input:
- household_id
- connection id

Output:
- imported orders count
- imported line items count
- sync warnings/errors

### `GET /api/pantry/summary`
Output:
- total items
- expiring in 7 days
- expired
- low stock
- suggested order list

## 5) Legal/Risk Guidance for Store Sync

- **Preferred**: official APIs + OAuth.
- **Fallback**: user-authorized browser automation for personal/private use only.
- Add disclosures:
  - connection may break when websites change
  - store terms may restrict automation
  - users can disconnect at any time

## 6) Practical MVP Boundaries

In 4-6 weeks, focus on:
- Auth + single household
- Receipt upload and parse
- Pantry quantities and expiry-first sorting
- Manual adjust usage
- Simple reorder suggestions (rule-based)

Delay until post-MVP:
- Multi-household sharing and permissions matrix
- Advanced forecasting models
- Dynamic pricing and coupon optimization
