# Wave 3 — Policy Commitments Architecture

**Status:** Simulation implementation  
**Owner:** `packages/sunrey-chain/src/economic-proof`  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`  
**Prerequisite:** Wave 2 sovereign blockchain core (blocks, finality, deterministic state)

This document describes the cryptographically versioned economic policy and
methodology commitment architecture introduced in Wave 3. It extends Evidence
and Rights commitments so sovereign blocks can answer:

> Under what rules was the economic interpretation performed?

---

## Core invariant

**Changing economic methodology must never silently reinterpret historical
monetary events.**

Every relevant monetary event must be attributable to the exact
policy/methodology version active when it was authorized.

---

## Policy taxonomy

Policies are **not** collapsed into one configuration object. Explicit categories:

| Policy type | Economy | Examples |
| --- | --- | --- |
| `VERIFICATION_POLICY` | PROTOCOL | Human contribution verification, eligibility thresholds |
| `HUMAN_CONTRIBUTION_POLICY` | SUNREY | Human contribution valuation constitution |
| `PRODUCTIVE_CONTRIBUTION_POLICY` | MOONREY | MoonRey attribution policy |
| `VALUATION_METHODOLOGY` | SUNREY / MOONREY | PEVE formulas, GPUV value function |
| `MONETARY_ISSUANCE_POLICY` | PROTOCOL | Chunk 71 constitution, MoonRey issuance bundle |
| `GOVERNANCE_POLICY` | PROTOCOL | Production activation firewall, Chunk 40 governance |
| `NETWORK_ECONOMIC_POLICY` | PROTOCOL | Consensus economic parameters |

Cross-economy methodology binding is forbidden:

- SunRey policy cannot authorize MoonRey methodology
- MoonRey policy cannot authorize SunRey methodology

---

## Methodology versioning

PEVE and GPUV formulas are **not modified** by Wave 3. Instead, claims and
valuations bind explicit methodology references:

```typescript
{
  methodologyId: 'peve-formula-v1',
  version: '1',
  economy: 'SUNREY',
  documentRef: 'packages/platform/src/value/formula.ts#FORMULA_V1',
  contentHash: '<sha256>'
}
```

GPUV references `moonrey.productive-value-function.simulation.v1` with
`policyVersion` as the methodology version.

A valuation result states: **this result was produced using methodology X
version Y.**

---

## Versioned policy definitions

Each `PolicyDefinition` supports:

| Field | Purpose |
| --- | --- |
| `policyId` | Stable identifier |
| `policyType` | Taxonomy category |
| `version` | Monotonic integer version |
| `effectiveFrom` / `effectiveUntil` | UTC validity window |
| `status` | `DRAFT`, `REGISTERED`, `SUPERSEDED`, `REVOKED` |
| `contentHash` | Immutable content commitment |
| `documentRef` | Off-chain document or code reference |
| `supersedes` | Prior version pointer |
| `governanceAuthorizationRef` | Signed governance decision |
| `schemaVersion` | Definition schema version |

Policy versions used by finalized monetary history remain recoverable via
the `PolicyRegistry`.

---

## Activation model

Three distinct states:

1. **POLICY EXISTS** — registered in `PolicyRegistry`
2. **POLICY IS ACTIVE** — `PolicyActivation` at `activationHeight`
3. **POLICY IS AUTHORIZED FOR MONETARY USE** — `authorizedForMonetaryUse: true`

Activation is governance-controlled. Forbidden activators:

| Actor | Monetary policy | Non-monetary policy |
| --- | --- | --- |
| AI / Automation | REJECTED | REJECTED for monetary types |
| Oracle | REJECTED | REJECTED |
| Exchange | REJECTED | REJECTED |
| Validator consensus alone | REJECTED | REJECTED |
| Protocol governance | PERMITTED | PERMITTED |
| Human governance | PERMITTED | PERMITTED |

---

## Governance binding

Monetary policy activation requires a `GovernanceDecisionRef`:

```typescript
{
  decisionId: 'gov.sim.policy-activation.v1',
  governancePolicyVersion: 1,
  contentHash: '<sha256>',
  evidenceReferences: ['evidence.sim.governance.policy.v1'],
  authorizedAtHeight: 1,
  actorKind: 'HUMAN_GOVERNANCE' | 'PROTOCOL_GOVERNANCE'
}
```

This composes with Chunk 40 protocol governance and Chunk 163 production
economic authorization. No AI governance shortcut exists.

---

## PolicyCommitment

Deterministic commitment over:

- policy ID, version, content hash
- effective range
- governance authorization reference
- methodology references

Full proprietary methodologies stay off-chain; commitment/reference is
sufficient.

Domain: `SUNREY_ECONOMIC_POLICY_COMMITMENT_V1`

---

## PolicyRoot

Deterministic Merkle root over active `PolicyCommitment` leaves at a block
height. Integrated with Wave 2 block `extensionCommitments.POLICY_ROOT`.

Domain: `SUNREY_ECONOMIC_POLICY_ROOT_V1`

---

## Five-root sovereign block architecture

| Root | Wave | Location |
| --- | --- | --- |
| Transaction Root | Wave 2 | `packages/sunrey-chain/src/blocks/commitments.ts` |
| Monetary State Root | Wave 2 | `packages/sunrey-chain/src/deterministic-state/hash.ts` |
| Evidence Root | Wave 3 | `packages/sunrey-chain/src/economic-proof/evidence/` |
| Rights Root | Wave 3 | `packages/sunrey-chain/src/economic-proof/rights/` |
| Policy Root | Wave 3 | `packages/sunrey-chain/src/economic-proof/policy/root.ts` |

Composite root: `SUNREY_SOVEREIGN_FIVE_ROOT_V1`

---

## Historical replay

Replay mode (`HISTORICAL`) requires pinned `policyId` + `policyVersion` +
`methodologyId` + `methodologyVersion`. Latest-policy lookup is forbidden.

Test scenario:

1. Policy v1 transaction at height 50
2. Policy v2 activation at height 100
3. Replay height 50 → reproduces v1 commitment and v1 methodology

Policy updates do **not**:

- Rewrite existing supply
- Revalue historical blockchain balances automatically
- Change finalized claims
- Alter historical EvidenceRoot / RightsRoot / PolicyRoot

Future economic consequences require new authorized transitions.

---

## Protocol upgrades vs economic policy changes

| Change type | Mechanism | History impact |
| --- | --- | --- |
| Protocol upgrade | Chunk 40 `UpgradePlan` at activation height | State migration spec; preserves historical verify |
| Economic policy change | `PolicyActivation` with governance ref | Append-only; prior commitments immutable |
| Methodology change | New `PolicyDefinition` version + activation | Historical events keep prior methodology binding |

---

## Policy audit inventory

`POLICY_AUDIT_INVENTORY` in `policy/audit.ts` catalogs current policy
surfaces (PEVE, GPUV, issuance, governance, verification) with storage
class:

- `HARD_CODED`, `CONFIGURATION`, `DATABASE_RECORD`, `DOCUMENT`,
  `RUNTIME_PARAMETER`, `SIMULATION_FIXTURE`

---

## Tests

| Suite | Path |
| --- | --- |
| Policy commitments | `packages/sunrey-chain/src/economic-proof/policy.test.ts` |
| Wave 2 + 3 integration | `tests/wave-3-policy-commitments.test.ts` |

---

## Must NOT activate

- Production monetization from policy commitments
- `LIVE_*` flags
- AI/Oracle/Exchange policy activation
- Cross-economy methodology binding
- Silent historical reinterpretation

---

## Related documents

- [`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`](./SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md)
- [`WAVE2_SOVEREIGN_BLOCKCHAIN_COMPLETION_REPORT.md`](./WAVE2_SOVEREIGN_BLOCKCHAIN_COMPLETION_REPORT.md)
- [`WAVE2_BLOCKS_FINALITY_STATE.md`](./WAVE2_BLOCKS_FINALITY_STATE.md)
