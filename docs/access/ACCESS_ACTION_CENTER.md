# Access Action Center Integration

Access Wave 4 feeds product events into the existing SunRey Action Center via `GET /api/v1/agent/external-events`. No second notification system.

## Event taxonomy

| Event | Priority | Channel |
|-------|----------|---------|
| `ACCESS_ALLOCATION_AVAILABLE` | INFO | Transactional |
| `ACCESS_BOOKING_CONFIRMED` | INFO | Transactional |
| `ACCESS_QUOTE_EXPIRING` | ACTION | Transactional |
| `ACCESS_PAYMENT_ACTION_REQUIRED` | ACTION | Transactional |
| `ACCESS_BOOKING_PROCESSING` | INFO | Transactional |
| `ACCESS_EXPIRING_SOON` | ACTION | Transactional |
| `ACCESS_OPPORTUNITY_AVAILABLE` | INFO | Promotional |
| `ACCESS_REFUNDED` / `ACCESS_PARTIAL_REFUND` | INFO | Transactional |
| `ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE` | IMPORTANT | Transactional (cooldown) |
| `ACCESS_TRANSACTION_FAILED` | IMPORTANT | Transactional |

Full list: `ACCESS_PRODUCT_EVENT_TYPES` in `packages/human-access-economy/src/product/taxonomy.ts`

## Example cards

- "Your 3 Mobility Days are available."
- "Your hotel booking is confirmed."
- "Your Access quote expires in 8 minutes."
- "We need a payment method for your $100 contribution."
- "Your $50 refund has been processed."

## Deduplication

Keys: `type:transactionId:stateTransitionId:resourceId`

Duplicate provider webhooks → one user notification.

## Cooldowns

- Provider unavailable: 15 minutes
- Opportunity available: 60 minutes (promotional)

Important state transitions are never suppressed by cooldown.

## Notification preferences

- **Transactional** — booking, refund, payment action (respects `transactionalEnabled`)
- **Promotional** — opportunities (respects `promotionalEnabled`; default `autoNotify: false`)

## Bridge

`packages/human-access-economy/src/product/action-center.ts` maps events to external Action Center format with `domain: 'access'`.
