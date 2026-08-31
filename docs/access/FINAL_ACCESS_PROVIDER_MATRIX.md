# Final Access Provider Matrix — Access V1

Classification: engineering audit as of 2026-08-31. `ENVIRONMENT=simulation`. All `LIVE_*` flags remain `false`.

This matrix does **not** assert production readiness. Providers marked `BLOCKED_FOR_PRODUCTION` may still allow simulation qualification to pass.

## Summary

| Provider | Booking path | Production status |
| --- | --- | --- |
| Expedia Rapid | Lodging sandbox | `BLOCKED_FOR_PRODUCTION` — no commercial production contract or live credentials |
| Turo | Mobility simulation | `BLOCKED_FOR_PRODUCTION` — partner approval required |
| DoorDash | Food simulation | `BLOCKED_FOR_PRODUCTION` — partner approval required |
| Amazon | Commerce simulation | `BLOCKED_FOR_PRODUCTION` — partner approval required |
| Airbnb | Stay simulation | `BLOCKED_FOR_PRODUCTION` — partner approval required |

**No production-capable Access fulfillment provider exists on current `main`.**

---

## Expedia Rapid (lodging / travel candidate)

| Field | Value |
| --- | --- |
| Provider | Expedia Rapid |
| Provider Type | Commercial lodging / travel API |
| Categories | `HOUSING_ROOM_NIGHTS`, `TRAVEL`, `VEHICLE_HOURS` |
| Capabilities | Catalog search, availability, quote, reserve, book, cancel, fulfillment status, webhooks (sandbox) |
| Geographies | US sandbox fixtures; production corridors `RESEARCH_REQUIRED` |
| Environment | `SANDBOX_AVAILABLE` (injected transport only) |
| Discovery | Yes (sandbox adapter) |
| Availability | Yes (sandbox) |
| Quote | Yes (sandbox) |
| Book | Yes (sandbox) |
| Cancel | Yes (sandbox) |
| Refund | Partial — cancellation supported; refund settlement is simulation intent only |
| Reconcile | Simulation webhook normalizer only |
| Payment Method | Fiat settlement intent → `packages/payments` (not live) |
| Contract Status | **No production commercial agreement** |
| Credential Status | Sandbox credential port exists; **no production secrets configured** |
| Compliance Status | `RESEARCH_REQUIRED` per corridor |
| Production Status | `BLOCKED_FOR_PRODUCTION` |
| Known Limitations | Live connectivity `false`. Rome E2E uses sandbox transport. No production webhook endpoint. |

Owner: `packages/access-economy/src/providers/adapters/expedia/`

---

## Turo (mobility candidate)

| Field | Value |
| --- | --- |
| Provider | Turo |
| Provider Type | Vehicle rental marketplace (partner-gated) |
| Categories | `VEHICLE_HOURS` / `VEHICLE_DAY` |
| Capabilities | Search, availability, quote, reserve, book, cancel, fulfillment status, webhooks declared; payout not supported |
| Geographies | Miami simulation fixture |
| Environment | `SIMULATED` / `PARTNER_APPROVAL_REQUIRED` |
| Discovery | Yes (Mustang Miami fixture) |
| Availability | Yes (≤4 vehicle-days simulation) |
| Quote | Yes |
| Book | Yes (simulation) |
| Cancel | Yes (simulation) |
| Refund | Cancel only; no live refund rail |
| Reconcile | Metrics counters only |
| Payment Method | Fiat intent; no live merchant settlement |
| Contract Status | **No partner agreement** |
| Credential Status | **None** |
| Compliance Status | `RESEARCH_REQUIRED` |
| Production Status | `BLOCKED_FOR_PRODUCTION` |
| Known Limitations | Mustang pricing is simulation ($91/day standard). Not a live Turo integration. |

Owner: `packages/access-economy/src/providers/adapters/turo/`

---

## DoorDash (food candidate)

| Field | Value |
| --- | --- |
| Provider | DoorDash |
| Provider Type | Food delivery marketplace (partner-gated) |
| Categories | `FOOD` |
| Capabilities | Search, availability, quote, fulfillment status, webhooks; **no book/cancel in production declaration** |
| Geographies | Simulation only |
| Environment | `PARTNER_APPROVAL_REQUIRED` |
| Discovery | Simulation scaffold |
| Availability | Simulation |
| Quote | Simulation |
| Book | Not declared for production |
| Cancel | Not declared for production |
| Refund | Not implemented |
| Reconcile | Not implemented |
| Payment Method | N/A |
| Contract Status | **None** |
| Credential Status | **None** |
| Compliance Status | `RESEARCH_REQUIRED` |
| Production Status | `BLOCKED_FOR_PRODUCTION` |
| Known Limitations | Delivery fulfillment candidate only; ordering scope not assumed |

---

## Amazon (commerce candidate)

| Field | Value |
| --- | --- |
| Provider | Amazon |
| Provider Type | Commerce marketplace (partner-gated) |
| Categories | `GOODS`, `FOOD` |
| Capabilities | Search, availability, quote, book, fulfillment status, webhooks declared |
| Geographies | Simulation only |
| Environment | `PARTNER_APPROVAL_REQUIRED` |
| Discovery | Simulation scaffold |
| Availability | Simulation |
| Quote | Simulation |
| Book | Simulation |
| Cancel | Simulation |
| Refund | Not wired to live rail |
| Reconcile | Not implemented |
| Payment Method | Fiat intent only |
| Contract Status | **None** |
| Credential Status | **None** |
| Compliance Status | `RESEARCH_REQUIRED` |
| Production Status | `BLOCKED_FOR_PRODUCTION` |
| Known Limitations | Scoped partner contract required for any live connectivity |

---

## Airbnb (stay candidate)

| Field | Value |
| --- | --- |
| Provider | Airbnb |
| Provider Type | Short-term stay marketplace (partner-gated) |
| Categories | `HOUSING_ROOM_NIGHTS`, `EXPERIENCES` |
| Capabilities | Search, availability, quote, reserve, book, cancel, webhooks declared |
| Geographies | Simulation only |
| Environment | `PARTNER_APPROVAL_REQUIRED` |
| Discovery | Simulation scaffold |
| Availability | Simulation |
| Quote | Simulation |
| Book | Simulation |
| Cancel | Simulation |
| Refund | Not wired to live rail |
| Reconcile | Not implemented |
| Payment Method | Fiat intent only |
| Contract Status | **None** |
| Credential Status | **None** |
| Compliance Status | `RESEARCH_REQUIRED` |
| Production Status | `BLOCKED_FOR_PRODUCTION` |
| Known Limitations | Production connectivity requires partner-scoped access |

---

## Production provider requirements checklist (all providers)

| Requirement | Expedia | Turo | DoorDash | Amazon | Airbnb |
| --- | --- | --- | --- | --- | --- |
| Commercial agreement | Missing | Missing | Missing | Missing | Missing |
| Production API access | Missing | Missing | Missing | Missing | Missing |
| Production credentials | Missing | Missing | Missing | Missing | Missing |
| Rate limits documented | Partial (defaults) | No | No | No | No |
| Webhook setup | Sandbox only | No | No | No | No |
| Terms / cancellation policy | Sandbox | Simulation | No | Simulation | Simulation |
| Reconciliation | Simulation | No | No | No | No |
| Support / escalation | No | No | No | No | No |
| Legal / compliance approval | `RESEARCH_REQUIRED` | `RESEARCH_REQUIRED` | `RESEARCH_REQUIRED` | `RESEARCH_REQUIRED` | `RESEARCH_REQUIRED` |

---

## Regulated production onboarding recommendation

Engineering may begin **sandbox / partner discovery** conversations using existing adapter contracts and capability registry, but **no provider may be marked live** until commercial agreement, credentials, compliance corridor review, and treasury limits are in place.

See `docs/access/ACCESS_V1_LAUNCH_GATES.md` (Gate C).
