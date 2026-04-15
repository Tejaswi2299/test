# MVP Build Checklist

## Product decisions needed from you

1. **Target users**
   - Just you/family (personal use) or public app for many users?
2. **Platforms**
   - Web only first, or mobile also?
3. **Store connection policy**
   - API-only now, or automation fallback allowed?
4. **Prediction complexity**
   - Rule-based first or ML from day one?
5. **Data privacy posture**
   - Do you want strict no-credential-storage policy?

## Sprint 1: Foundation

- [ ] Create Supabase project.
- [ ] Enable Auth providers (email + Google).
- [ ] Create core schema tables.
- [ ] Configure row-level security by household.
- [ ] Build React app shell + protected routes.

## Sprint 2: Receipt to Pantry

- [ ] Upload receipts to Storage.
- [ ] Build extraction edge function.
- [ ] Persist receipts and line items.
- [ ] Pantry auto-update from parsed items.
- [ ] User correction flow for OCR mistakes.

## Sprint 3: Smart Inventory

- [ ] Pantry list with remaining quantity.
- [ ] Expiry badges + “use first” queue.
- [ ] Low-stock thresholds.
- [ ] Auto shopping list draft.

## Sprint 4: Predictions + Store Sync

- [ ] Weekly prediction job.
- [ ] Recommendation cards with rationale.
- [ ] Implement one store connector end-to-end.
- [ ] Add sync logs and error handling.

## Non-functional checklist

- [ ] Audit logs for ingestion and sync.
- [ ] Retry queue for failed parses/sync.
- [ ] Rate limiting and abuse controls.
- [ ] Data deletion/export flow.
- [ ] Observability (errors, latencies, extraction confidence).

## Acceptance criteria (MVP)

- User can sign in and upload a receipt.
- App extracts most line items with editable corrections.
- Pantry view shows what is in stock and what expires first.
- App suggests what to buy for the coming week.
- User can disconnect store connection and delete data.
