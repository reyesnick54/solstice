# Chunk 136 — Bandwidth, Telecom & Digital Network Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation: `packages/sunrey-chain/src/oracle/production/provider-families/bandwidth`.

Capability `sunrey-bandwidth-network-data-fabric` is `IMPLEMENTED` on the
existing `sunrey-production-oracles` owner. It does not create a second
oracle network, a second mint, or a live named-provider integration.

This chunk is the provider-neutral economic metering architecture for
bandwidth capacity and transferred network service.

It does **not** store packet payloads, DNS history, URLs, browsing
history, message or email contents, user IP logs, subscriber browsing
profiles, or authentication tokens.

No live commercial provider is contacted. Production valuation remains
inactive.

## Source classes

`ISP_USAGE_METER`, `TELECOM_NETWORK_METER`, `CDN_METERING`,
`NETWORK_EDGE_METER`, `CLOUD_EGRESS_METER`, `PEERING_METER`,
`TRANSIT_PROVIDER_METER`, `DATA_CENTER_NETWORK_METER`,
`ENTERPRISE_NETWORK_METER`, `SATELLITE_NETWORK_METER`,
`SUBSEA_CAPACITY_REFERENCE`, `INDEPENDENT_NETWORK_ATTESTATION`.

Named vendors are not required. Five APIs operated by one
telecom/controller are not five independent controllers. Chunk 128
independence controls still apply.

## Fact types

Existing facts only:

- `BANDWIDTH_CAPACITY`
- `BANDWIDTH_USAGE`

`NETWORK_VALUE`, `INTERNET_VALUE`, and `TRAFFIC_VALUE` are refused.

## V1 / V2 bandwidth usage schema

Historical oracle observations used `GB_s` for both capacity and usage.
That collapses data rate into data transferred.

| Schema | Quantity kind | Units | Status |
| --- | --- | --- | --- |
| `BANDWIDTH_USAGE_SCHEMA_V1` / `bandwidth.usage.v1` | `DATA_RATE` | `GB_s` | Historical compatibility. Not rewritten. |
| `BANDWIDTH_USAGE_SCHEMA_V2` / `bandwidth.usage.v2` | `DATA_VOLUME` | `GB`, `TB` | Governed volume contract. |
| `BANDWIDTH_CAPACITY` / `bandwidth.capacity.v1` | `DATA_RATE` | `GB_s`, `B_s` | Capacity remains a rate. |

`FACT_SCHEMAS.BANDWIDTH_USAGE` is a governed upgrade: default remains
`GB_s` so V1 observations still admit, and `GB` / `TB` are now allowed
for V2 volume evidence.

`DATA_RATE != DATA_VOLUME`. `GB/s` is not `GB`.

## Capacity versus usage

`BANDWIDTH_CAPACITY` is available or contracted rate. It is not
automatically realized usage.

`BANDWIDTH_USAGE` is transferred/used network service.

- If a source reports total bytes, use canonical data-volume units.
- If a source reports a verified average rate over a measurement
  period, `rate × duration` may derive volume.
- Duration is required. No float. Example: `2 GB/s` for `10` seconds
  → `20 GB`.

## Transfer semantics

These classes are not interchangeable:

`GROSS_NETWORK_BYTES`, `VERIFIED_TRANSFERRED_BYTES`,
`BILLABLE_EGRESS_BYTES`, `DELIVERED_BYTES`, `PEERING_BYTES`,
`TRANSIT_BYTES`, `CACHE_EGRESS_BYTES`.

Retransmission can make physical traffic exceed useful delivered data.
Gross wire bytes are not silently treated as delivered application
data.

## Event identity and stages

Privacy-safe references cover network service, connection/service
agreement, provider, network edge, transfer interval, traffic
aggregate, and route/peering domain. Packet identity, URL, and user
identity are not required and must not be stored.

Router, CDN, cloud, ISP, and customer-edge meters may corroborate one
transfer. They are not automatically five productive services.

Origin hosting, transit, CDN, and last-mile access may be distinct
network services. They are not collapsed automatically. Cache hits
measure network service; they do not create copies of underlying
content as new economic goods.

Digital storage (data at rest) remains a separate `STORAGE_CAPACITY`
fact even when both use byte units.

## Quality and utilization

Latency, packet loss, availability, and uptime are supporting quality
evidence. They are not added to transferred quantity.

Utilization is actual compatible traffic volume / governed capacity
volume after `rate × duration` when the capacity basis is a rate.
Numerator and denominator must share service class, interval, and
compatible geography. `GB / (GB/s)` without time is refused.

## Certification and issuance

Sandbox feeds cover capacity-rate, transferred bytes, rate-over-time
usage, CDN aggregate, and peering/transit aggregate.

Certification cannot mint MoonRey. Bandwidth facts cannot auto-mint.
The Economic Asset Registry receives metadata/commitments only.

See [`chunk-136.json`](../architecture/chunks/chunk-136.json).
