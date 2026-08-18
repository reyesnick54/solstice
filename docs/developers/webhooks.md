# Webhooks

Application webhooks deliver authorized SunRey events. Only events the
application is permitted to receive are sent.

## Events

- `transaction.finalized`
- `deposit.detected`
- `withdrawal.state_changed`
- `exchange.order.state_changed`
- `exchange.trade.finalized`
- `governance.event`
- `validator.event`
- `moonrey.issuance.receipt`
- `machine.commerce.settlement`
- `information.request.submitted`
- `information.consent.changed`
- `information.usage.recorded`

Human Information webhook events require a `HUMAN_INFORMATION_*` scope.
Ordinary `CHAIN_READ` is not sufficient.

## Signing (`sunrey-webhook-v1`)

HMAC-SHA256 over:

```
sunrey-webhook-v1.{deliveryId}.{eventId}.{timestamp}.{attempt}.{sha256(body)}
```

Headers:

- `X-SunRey-Webhook-Id`
- `X-SunRey-Event-Id`
- `X-SunRey-Timestamp`
- `X-SunRey-Attempt`
- `X-SunRey-Signature` (`sunrey-webhook-v1=<hex>`)
- `X-SunRey-Webhook-Scheme`

## Replay protection

Reject a delivery when:

- the signature does not match
- the timestamp is outside the five-minute UTC skew window
- the `delivery_id` was already accepted

Consumers treat `(event_id, delivery_id)` as the idempotency key.

## Delivery states

`PENDING` → `DELIVERED` or `RETRYING` → `PERMANENTLY_FAILED`

Retries are bounded (five attempts, exponential backoff). There is no
infinite delivery loop.

## Destination security

Rejected:

- private IPv4/IPv6 and link-local / metadata hosts
- non-HTTPS production destinations
- URL credentials
- redirects
- responses larger than 8 KiB

Verify with `verifyWebhookSignature` from `@solstice/sunrey-sdk`.
The official SDK never asks you to send private keys or webhook secrets
to SunRey servers.
