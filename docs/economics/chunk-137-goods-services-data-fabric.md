# Chunk 137 — Goods, Commerce & Service Delivery Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-goods-services-data-fabric` is `IMPLEMENTED` at
`packages/sunrey-chain/src/oracle/production/provider-families/goods`
and
`packages/sunrey-chain/src/oracle/production/provider-families/service-delivery`.
It extends the existing `sunrey-production-oracles` owner. It does not
create a second oracle network, a second mint, a named commerce vendor
integration, or a live service provider. The service family directory is
`service-delivery` rather than `services` so import paths do not collide
with the application `services/` packages that architecture lint forbids
library code from importing.

## Why this exists

Finished-goods ledgers, warehouse fulfillment, merchant delivery, and
service-completion systems describe economic evidence. They are not
automatic MoonRey. This fabric keeps the following distinctions:

- an order is not goods output
- a payment is not production or delivery
- an invoice is not service completion
- manufacturing output registered as a finished-goods batch is the
  same underlying event or a derived view, not 200 units of credit
- harvested produce registered as a goods batch is not a second
  production event
- merchant `GOODS_DELIVERY` and carrier `DELIVERY_COMPLETION` may
  describe one physical delivery from different economic views
- a booking is not a completed service

## Goods source classes

Provider-neutral classes only. Named commerce vendors are not required.

- `ERP_GOODS_LEDGER`
- `ORDER_MANAGEMENT_SYSTEM`
- `WAREHOUSE_FULFILLMENT_SYSTEM`
- `MERCHANT_FULFILLMENT_SYSTEM`
- `PRODUCT_BATCH_REGISTRY`
- `SERIALIZED_GOODS_SYSTEM`
- `POINT_OF_SALE_REFERENCE`
- `RECEIVER_ACCEPTANCE_SYSTEM`
- `INDEPENDENT_GOODS_ATTESTATION`

ERP, OMS, WMS, and POS owned by the same retailer are not four
independent controllers.

## Service source classes

- `FIELD_SERVICE_MANAGEMENT`
- `SERVICE_ORDER_SYSTEM`
- `PROFESSIONAL_SERVICE_SYSTEM`
- `MAINTENANCE_COMPLETION_SYSTEM`
- `DIGITAL_SERVICE_METER`
- `API_SERVICE_METER`
- `FACILITY_SERVICE_SYSTEM`
- `BOOKING_COMPLETION_SYSTEM`
- `WORK_ORDER_SYSTEM`
- `INDEPENDENT_SERVICE_ATTESTATION`

These classes do not share one physical measurement.

## Canonical facts

Existing facts only:

- `GOODS_OUTPUT`
- `GOODS_DELIVERY`
- `SERVICE_DELIVERY`

Do not create `REVENUE`, `SALES_VALUE`, or `INVOICE_VALUE` as
productive-output facts. Sales price and revenue may appear as
reference context. They are not a `$1 → X GPUV` or `$1 → X MoonRey`
mapping.

## Goods output and delivery

Goods lifecycle states are `CREATED`, `ACCEPTED`, `REJECTED`,
`AVAILABLE`, `FULFILLED`, `RETURNED`, and `DESTROYED`. Only
`ACCEPTED`, `AVAILABLE`, and `FULFILLED` may support `GOODS_OUTPUT`.

`QUOTE`, `CART`, `ORDER_CREATED`, `ORDER_ACCEPTED`, `BACKORDER`, and
`SCHEDULED` do not prove goods were produced.

`PICKED`, `PACKED`, `SHIPPED`, and `IN_TRANSIT` are not final goods
delivery. Governed completion requires `DELIVERED`, `RECEIVED`, or
`ACCEPTED`.

A returned good does not erase historical production. The return is a
new event plus inventory state. Historic evidence is not deleted.
MoonRey is not automatically clawed back. If attribution was already
settled, the Chunk 122 book flags `MONETARY_ADJUSTMENT_REVIEW_REQUIRED`.

Cancelled before realization: no completed event. Cancelled after
completion: correction/history semantics, never silent deletion.

Goods units are `units_produced` / `UNIT`, `kg`, and `tonne`. Item
counts are not converted into mass without explicit product-specific
evidence.

## Service completion and units

`SERVICE_DELIVERY` historically allowed `units_produced` and
`machine_h`. Chunk 137 adds a governed extension that also allows
`service_hour` for genuine time-based services.

- Time-based services require an explicit integer duration and use
  `service_hour`. Hours are not inferred from invoice amount.
- `machine_h` is not a human service hour. Historical `machine_h`
  records remain valid as machine-time evidence and are not rewritten.
- Unitized services (a service call, inspection, completed API job,
  or maintenance operation) may use an item count when the service
  definition is explicit. Unitized services are not economically
  equivalent to each other.
- Digital services may evidence a completed request, processed job,
  governed usage unit, or service time. Customer content, prompts,
  documents, private inputs, and API payload bodies are not stored.

The oracle `UNIT_CODES` list now includes `service_hour`. The
`SERVICE_DELIVERY` fact schema allowed units are
`units_produced`, `machine_h`, and `service_hour`. The services
fabric also accepts the extension schema id
`service.delivery.v1.service_hour`.

## Human services boundary

This MoonRey provider family does not value the intrinsic worth of a
human worker. Human contributions that belong under the Human
Economic Contribution Registry are referenced, not duplicated as a
MoonRey human-worth measurement. `SERVICES` may represent realized
economic service events according to policy. It is not a person's
worth, creditworthiness, or social value.

A service may involve human labor, AI, automation, and equipment.
This chunk does not automatically issue both SunRey and MoonRey for
the same event. Contribution and economic-event lineage is preserved
so later policy can distinguish those roles. Dual-coin allocation is
not guessed here.

## Rights, privacy, and registry

License and rights references may be attached for digital goods,
licensed services, and commercial delivery. IP ownership is not
inferred.

Public evidence uses pseudonymous refs and commitments. Customer
names, shipping addresses, payment-card data, email, phone, order
notes, support-chat content, and private service payloads are
refused.

The Economic Asset Registry receives goods and service source-dataset
metadata, observation commitments, and verified-fact projections. It
does not receive raw customer or order content.

## Production posture

```
ORDER_EQUALS_OUTPUT=false
INVOICE_EQUALS_COMPLETED_SERVICE=false
PAYMENT_EQUALS_PRODUCTIVE_OUTPUT=false
HUMAN_WORTH_SCORING=false
REAL_PROVIDER_CONTACTED=false
PRODUCTION_ACTIVE=false
```

Facts cannot auto-mint MoonRey. There is no live provider integration.

Do not create `packages/goods-oracles`, `packages/commerce-data-fabric`,
`packages/services-oracle`, or `packages/moonrey-commerce`.
