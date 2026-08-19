# Chunk 133 — Minerals, Natural Resources & Extraction Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation: `packages/sunrey-chain/src/oracle/production/provider-families/resources`.

This chunk extends the existing `sunrey-production-oracles` owner. It does
**not** create a second oracle network, mint, Productive Value Function, or
named provider integration.

Capability `sunrey-production-oracles` remains singular. Bounded capability
`sunrey-resource-extraction-data-fabric` names this provider-neutral evidence
layer. Source taxonomy, provider certification, and the Economic Asset
Registry fabric stay on their existing owners.

## What this is

Provider-neutral economic evidence architecture for:

- mineral reserves / resources
- mining / extraction
- raw-material production
- stockpile measurement

## Mandatory separations

| Concept | Fact / semantics | Not |
| --- | --- | --- |
| Estimated stock | `RESOURCE_RESERVE` | realized extraction, OUTPUT, MoonRey eligibility |
| Realized extraction | `RESOURCE_EXTRACTION` | reserve estimate |
| Processing / concentrate | transformation lineage | added ore mass |
| Stockpile | inventory evidence | new extraction |
| Ownership / rights | explicit party roles | operator inferred as legal owner |
| Commodity price | `reference_price` → `REFERENCE_PRICE` | resource existence, ownership, or extraction |

Forbidden ambiguous facts: `RESOURCE_VALUE`, `MINERAL_VALUE`.

A reserve estimate does **not** prove extraction, create OUTPUT, or become
MoonRey eligible. Existing RESERVE-claim restrictions are preserved.

## Mass units

Canonical mass is `kg` and `tonne` through exact unit normalization. No
floating point. Volume is not mass unless a governed density/context
conversion exists. Missing density fails closed.

Gross vs net semantics stay explicit:

`GROSS_EXTRACTED_MASS`, `NET_SALEABLE_MASS`, `WASTE_MASS`, `OVERBURDEN`,
`MOISTURE_ADJUSTED_MASS`, `PROCESSED_CONCENTRATE`.

Assay grade is quality/composition evidence, not physical mass. `mass × grade`
is refused unless policy explicitly allows `CONTAINED_MATERIAL_MASS`.

## Event identity

Truck, belt scale, weighbridge, mine production system, and ERP inventory
may describe one extraction event. Chunk 120 identity (mine/site, pit/zone,
campaign, shift, haul batch, weighbridge ticket, lot, stockpile) clusters
those observations. They are not automatically five independent OUTPUT
quantities.

1,000 tonnes ore extracted → processing → 100 tonnes concentrate is lineage,
not 1,100 tonnes of the same resource output.

Mine-face → truck → stockpile does not create new extraction. Stockpile
reconciliation uses opening + inflows − outflows ± governed adjustments
≈ closing, with an **explicit** gram tolerance. Reserve estimates are not
automatically depleted by extraction events unless the reserve methodology
says so.

## Rights and geography

Operator, controller, rights holder, concession/license holder, and custodian
remain separate references. A fixture concession is not proof of real
authorization. Extraction policy may require a rights reference and fail
closed when it is missing.

Geography supports jurisdiction, mine region, and resource zone. Precise
locations of protected sites stay redacted under default policy.

Environmental telemetry may be operational/compliance evidence. It is not a
productive-value multiplier in this chunk.

## Independence and quality

Mine telemetry + mine ERP + mine weighbridge under one controller are not
independent organizations. Independent assay, audit, or regulatory sources
may be independent only when the controller/upstream organization actually
differ.

Resource-specific quality inputs (scale calibration, assay provenance,
sampling methodology, freshness, batch identity, independence, stockpile
reconciliation) feed the existing oracle quality formula. This is not a
second opaque score.

## Certification

Sandbox feeds exist for extracted tonnage, weighbridge, reserve reference,
stockpile, and assay attestation. Certification still cannot authorize
MoonRey, finalize an oracle fact, or activate production ingestion.

## Demo

```
npm run demo:moonrey-resource-data-fabric
```

Prints:

```
RESERVE_EQUALS_EXTRACTION=false
STOCKPILE_MOVEMENT_EQUALS_EXTRACTION=false
REFERENCE_PRICE_CREATES_OUTPUT=false
LEGAL_OWNERSHIP_INFERRED=false
REAL_PROVIDER_CONTACTED=false
PRODUCTION_ACTIVE=false
```

## What this does not do

No real external providers. No production activation. No tokenomics changes.
No automatic mint. Chunk 71 remains the issuance authority.
