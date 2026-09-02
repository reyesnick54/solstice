# SunRey Identity and Authority Model

**Version:** 1.0.0-wave7  
**Status:** Architectural specification  
**Owner:** `packages/identity`  
**Companion:** `docs/architecture/WAVE7_FINE_GRAINED_AUTHORIZATION.md`, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`, `docs/architecture/adr/ADR-0007-identity-and-authentication-stack.md`

---

## 1. Authority planes

SunRey separates four authority planes. They must not be conflated.

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION          Who is this session?                   │
│  (login, OIDC, passkey)                                         │
├─────────────────────────────────────────────────────────────────┤
│  AUTHORIZATION           What relationships does this actor     │
│  (ReBAC tuples)          possess on resources?                  │
├─────────────────────────────────────────────────────────────────┤
│  POLICY                  Is this action allowed under           │
│  (jurisdiction, purpose) jurisdiction and purpose rules?        │
├─────────────────────────────────────────────────────────────────┤
│  EXECUTION AUTHORITY     May this specific mutation proceed?     │
│  (Kernel + HMAC EA)      Signed, scoped, short-lived.           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Identity types

### 2.1 Authentication identity

- **Purpose:** Login, session, MFA, device trust
- **Owner:** `packages/identity`
- **Examples:** OIDC `sub`, session ID, passkey credential
- **Must not:** Replace economic identity; authorize monetary mutation

### 2.2 Human economic identity

- **Purpose:** Pseudonymous contribution, HIN, settlement eligibility
- **Owner:** `packages/human-economic-contribution`, `packages/identity` (binding)
- **Examples:** `econ:alice_pseudo`, contribution fingerprint
- **Must not:** Be inferred from login alone; carry raw PII

### 2.3 Wallet identity

- **Purpose:** Custody and on-chain account control
- **Owner:** `packages/custody`, `packages/sunrey-chain/src/wallet`
- **Examples:** Wallet ref, M-of-N policy, delegated keys
- **Must not:** Convey governance or issuance authority

### 2.4 Governance identity

- **Purpose:** Human governance ceremony participation
- **Owner:** `packages/sunrey-chain/src/governance-ops`, `packages/sunrey-chain/src/mainnet/authorization.ts`
- **Examples:** Ceremony participant ref, governance evidence
- **Must not:** Execute transactions; bypass Kernel

### 2.5 Validator identity

- **Purpose:** Consensus participation, block validation
- **Owner:** `packages/sunrey-chain/src/validator-operator`
- **Examples:** Operator ref, validator key role
- **Must not:** Authorize monetary proposals; mutate customer assets

---

## 3. Actor types and authority boundaries

| Actor | Authentication | Authorization relationships | Policy | Execution Authority |
| --- | --- | --- | --- | --- |
| Human User | Required | CONTROLS wallet, GRANTED consent | Jurisdiction + KYC | Via Kernel ALLOW |
| Human Governance | Ceremony-bound | MAY_AUTHORIZE monetary proposal | Governance evidence | Never direct mutation |
| Administrator | Staff session | MANAGES domain (scoped) | SoD matrix | Never monetary supply |
| AI Agent | Mandate token | ACTS_FOR user (delegated) | Proposal-only | **Never** |
| Service Identity | mTLS/credential | MAY_READ dataset | Purpose-bound | Scoped service caps |
| Provider | Provider credential | Provider-scoped | Certification gate | Never mint |
| Enterprise | KYB identity | OPERATES productive asset | License config | Never personal data |
| Validator | Operator credential | MAY_VALIDATE block | Consensus rules | Never governance |
| Wallet Controller | Step-up + policy | CONTROLS wallet | Kernel proofs | EA for permitted ops |
| Auditor | Staff session | Read surfaces only | Audit policy | Read-only |

---

## 4. Delegation model

Delegation is **constrained**, not transitive authority inheritance.

```
Human User
  └─ delegates (scope, purpose, expiration)
       └─ AI Agent
            ├─ permitted: read, analyze (scoped resources)
            └─ forbidden: withdraw, consent, issuance, governance
```

Properties:

- `scope` — resource type and IDs
- `purpose` — bound purpose identifier
- `expiration` — `expiresAt` timestamp (UTC)
- `revocation` — `revokedAt` null or timestamp

Non-delegatable: governance, admin, validator, monetary issuance, consent modification, production activation.

---

## 5. Relationship-based authorization

Canonical tuples (OpenFGA-compatible):

```
user:alice#controls@wallet:wallet_alice
user:alice#granted@consent:consent_1
organization:acme#operates@productive_asset:facility_1
service:analytics#may_read@dataset:market_data
agent:fin_agent#acts_for@user:alice
admin:sec_ops#manages@domain:sanctions
human_governance:council#may_authorize@monetary_proposal:prop_1
validator:val_1#may_validate@block:block_100
```

Evaluation: `FineGrainedAuthorization.check()` in `packages/identity/src/fine-grained`.

---

## 6. Service identity (zero-trust)

Backend services carry explicit `ServiceIdentity` records (`packages/security/src/identity.ts`).

Principles:

1. No implicit trust from internal network placement
2. Each call requires `assertServiceCapability`
3. Resource-scoped tuples for data access (`SERVICE MAY_READ DATASET`)
4. Cross-service administration denied without explicit binding

---

## 7. Administrative authority

Staff roles (`packages/identity/src/admin-roles.ts`):

- 13 explicit roles; **no SUPER_ADMIN**
- `PLATFORM_ADMIN` ≠ union of all roles
- Segregation of duties (`packages/identity/src/staff/sod.ts`)
- Dual control for destructive actions
- Administrative roles **cannot bypass** protocol monetary controls

Sensitive actions map to required roles in `SENSITIVE_ADMIN_ACTIONS`.

---

## 8. Monetary authority (unchanged)

Per `SUNREY_MONETARY_AUTHORITY_CONTRACT.md`:

- Only `PROTOCOL` and `HUMAN_GOVERNANCE` may mutate canonical supply
- AI, Agent, Exchange, Oracle, Database are **forbidden supply mutators**
- Governance evidence required on MAINNET
- Authorization relationships do not grant supply mutation

---

## 9. Identity federation

Production path (ADR-0007, deferred):

```
External IdP (Ory Kratos / Keycloak per cell)
  → OIDC tokens
  → IdentityFederationPort (anti-corruption)
  → AuthenticationIdentity
  → controlled link
  → HumanEconomicIdentity (pseudonymous, persistent)
```

Login identity change does not alter economic identity binding when `BINDS_ECONOMIC` link is preserved or explicitly rotated.

---

## 10. Integration with existing packages

| Package | Role in model |
| --- | --- |
| `packages/identity` | Authentication, authorization context, fine-grained tuples |
| `packages/permissions` | Execution Authority (financial mutations) |
| `packages/kernel` | Six proofs, policy engine |
| `packages/consent` | Purpose-scoped data use permits |
| `packages/personal-data-vault` | Field-level vault access |
| `packages/sunrey-agent` | Mandate narrowing; proposal-only |
| `packages/security` | Service identity registry |
| `packages/custody` | Wallet actor input, step-up |

---

## 11. Fail-closed summary

| Condition | Outcome |
| --- | --- |
| Missing authentication | 401 / session refused |
| Missing relationship | `RELATIONSHIP_MISSING` |
| Missing policy proof | Kernel BLOCK/REFUSE |
| Agent self-approval | `AGENT_CANNOT_SELF_APPROVE` |
| Expired delegation | `DELEGATION_DENIED` |
| Admin monetary bypass | `MONETARY_BYPASS_FORBIDDEN` |
| Validator as governance | `ACTOR_TYPE_MISMATCH` |
| Kernel refusal | Returned unchanged |

---

## Contract maintenance

Changes require test updates in `packages/identity/src/fine-grained-authorization.test.ts` and architectural linter pass. No new `packages/authorization` or `packages/rbac` packages.
