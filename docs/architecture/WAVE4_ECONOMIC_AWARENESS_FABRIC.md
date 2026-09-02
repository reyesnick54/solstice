# Wave 4 — Economic Awareness Fabric

**Version:** 1.0.0-wave4-prompt2  
**Status:** Architectural specification (Wave 4 Prompt 2)  
**Owner:** `packages/provider-sdk` (governed connector framework)

---

## Purpose

Before external economic information can influence reasoning, certification, trust, or issuance pipelines, the system must know:

| Dimension | Question |
|-----------|----------|
| **WHO** | Which provider supplied the information? |
| **HOW** | How was it obtained (connector type, auth, transport)? |
| **CLASS** | What source class does it belong to? |
| **RIGHTS** | What license, persistence, and redistribution rules apply? |
| **FRESHNESS** | How fresh is the data expected to be? |
| **TRUST** | How trustworthy is it currently considered? (separate from operational health) |
| **DOMAIN** | What economic domain does it belong to? |

Wave 4 Prompt 2 implements the **governed provider and connector plane** that answers WHO, HOW, CLASS, RIGHTS, FRESHNESS, and DOMAIN at fetch time. Trust evaluation remains in the External Data Trust Engine (`packages/provider-sdk/src/trust`).

---

## Components

| Component | Location | Role |
|-----------|----------|------|
| ProviderDefinition | `packages/provider-sdk/src/connector/provider-definition.ts` | Versioned metadata without credentials |
| Source classes | `packages/provider-sdk/src/connector/source-class.ts` | Independence taxonomy for consensus |
| Provider lineage | `packages/provider-sdk/src/connector/lineage.ts` | Upstream derivation; republishers not independent |
| Governed connector | `packages/provider-sdk/src/connector/governed-connector.ts` | Transport + normalization handoff only |
| REST connector | `packages/provider-sdk/src/connector/rest-connector.ts` | Fixture simulation + live HTTP path |
| Operational health | `packages/provider-sdk/src/connector/operational-health.ts` | AVAILABLE / DEGRADED / … (not trust) |
| Provider inventory | `packages/provider-sdk/src/connector/inventory.ts` | Catalog audit across `config/providers` |
| Free API catalog | `config/providers/free-api-catalog.yaml` | Authoritative provider metadata store |

---

## Boundaries

Connectors **must not**:

- Verify an economic fact
- Create GPUV or PEVE
- Mint native supply
- Approve issuance

Configured provider ≠ trusted provider. Operational health ≠ provider reputation.

---

## Companion documents

- `docs/architecture/WAVE4_PROVIDER_CONNECTOR_FRAMEWORK.md`
- `docs/architecture/SUNREY_PROVIDER_REGISTRY.md`
- `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

**Wave 4 Prompt 2 scope ends at connector governance.** Prompt 3 covers additional economic awareness layers.
