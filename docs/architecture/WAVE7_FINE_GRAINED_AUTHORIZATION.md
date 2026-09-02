# Wave 7 — Fine-Grained Authorization

**Version:** 1.0.0-wave7  
**Status:** Architectural specification + simulation implementation  
**Owner:** `packages/identity/src/fine-grained`  
**Companion:** `docs/architecture/WAVE7_POLICY_AS_CODE.md`, `docs/architecture/SUNREY_IDENTITY_AND_AUTHORITY_MODEL.md`, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

---

## 1. Objective

Build authorization capable of determining:

**WHO** can do **WHAT** to **WHICH RESOURCE** under **WHICH RELATIONSHIP**.

| Layer | Question |
| --- | --- |
| Policy | Is this action allowed? (jurisdiction, purpose, consent) |
| Authorization | Does this principal possess the relationship/permission necessary to attempt it? |

These layers work together. Neither substitutes for the other.

---

## 2. Authorization audit (Task 1)

### Current state (pre-Wave 7)

| Area | Location | Granularity | Gap |
| --- | --- | --- | --- |
| Customer capabilities | `packages/identity/src/capability.ts` | Flat ~70 `IdentityCapability` booleans | No resource-scoped relationships |
| Product capabilities | `packages/identity/src/product-capability.ts` | Flat product aliases | No delegation scope |
| Staff roles | `packages/identity/src/admin-roles.ts` | 13 roles, no SUPER_ADMIN | Good separation; not relationship-based |
| Staff SoD | `packages/identity/src/staff/sod.ts` | Action matrix | Privileged ops only |
| Resource ownership | `packages/identity/src/resource-ownership.ts` | IDOR registry | Limited resource kinds |
| Service identities | `packages/security/src/identity.ts` | Flat `ServiceCapability[]` | No resource tuples |
| Vault access | `packages/personal-data-vault/src/access.ts` | Purpose/field/retention | Ahead of other surfaces |
| Consent delegation | `packages/consent/src/product` | Category/purpose bounded | Separate from identity grants |
| Agent mandates | `packages/sunrey-agent` | Action class narrowing | Proposal-only |
| Developer API | `packages/sunrey-sdk/src/developer-platform/permissions.ts` | Flat OWNER/ADMIN/DEVELOPER/VIEWER | Coarse |
| Validator roles | `packages/sunrey-chain/src/validator-operator/types.ts` | Operator roles | Not unified with identity |
| API context | `services/api/src/context.ts` | `authenticated` + empty scopes | Placeholder |

### Flat systems becoming too coarse

1. `IdentityCapability[]` on `ActorContext` — no resource binding
2. Developer platform scopes — no relationship semantics
3. Service capabilities — no dataset/resource tuples
4. `CapabilityGrant.source: 'RELATIONSHIP'` — typed but not wired

---

## 3. OpenFGA evaluation (Task 2)

### Decision: **Deferred — typed port adopted**

| Criterion | OpenFGA | SunRey choice |
| --- | --- | --- |
| Relationship tuples | Native | `RelationshipTuple` matches OpenFGA format |
| Runtime dependency | External service | None in simulation |
| Architectural fit | Excellent for ReBAC | Composes with existing identity owner |
| ADR alignment | Not in ADR-0006 scope | Typed engine per ADR-0006 Option C |

**Implementation:**

- `FineGrainedAuthorization` interface (`packages/identity/src/fine-grained/interface.ts`)
- `SimulationRelationshipEngine` — in-memory tuple store for simulation/tests
- `OpenFgaAuthorizationAdapter` — port defined, not implemented

Tuple format: `subjectType:subjectId#relation@objectType:objectId`

---

## 4. Relationship model (Task 3)

| Tuple | Subject | Relation | Object | Permitted verbs |
| --- | --- | --- | --- | --- |
| `USER_CONTROLS_WALLET` | HUMAN_USER | CONTROLS | WALLET | read, withdraw, operate |
| `USER_GRANTED_CONSENT` | HUMAN_USER | GRANTED | CONSENT | read, manage |
| `ORGANIZATION_OPERATES_PRODUCTIVE_ASSET` | ENTERPRISE | OPERATES | PRODUCTIVE_ASSET | read, operate, manage |
| `SERVICE_MAY_READ_DATASET` | SERVICE_IDENTITY | MAY_READ | DATASET | read, analyze |
| `AGENT_ACTS_FOR_USER` | AI_AGENT | ACTS_FOR | USER | read, analyze |
| `ADMIN_MANAGES_DOMAIN` | ADMINISTRATOR | MANAGES | DOMAIN | manage, operate |
| `HUMAN_GOVERNANCE_MAY_AUTHORIZE_MONETARY_PROPOSAL` | HUMAN_GOVERNANCE | MAY_AUTHORIZE | MONETARY_PROPOSAL | authorize, approve |
| `VALIDATOR_MAY_VALIDATE_BLOCK` | VALIDATOR | MAY_VALIDATE | BLOCK | validate |

Roles are **not conflated**. A validator tuple does not grant governance authority.

---

## 5. Actor types (Task 4)

Explicit separation in `AUTHORIZATION_ACTOR_TYPES`:

| Actor type | May hold | Must not inherit without explicit delegation |
| --- | --- | --- |
| HUMAN_USER | Own resources, consent | Governance, admin, validator |
| HUMAN_GOVERNANCE | Monetary proposal authorization | Transaction execution |
| ADMINISTRATOR | Domain management (scoped) | Monetary supply mutation |
| AI_AGENT | Delegated read/analyze | Withdraw, consent change, issuance, governance |
| SERVICE_IDENTITY | Explicit dataset reads | Admin, governance |
| PROVIDER | Provider-scoped operations | Customer resources |
| ENTERPRISE | Productive asset operations | Personal data |
| VALIDATOR | Block validation | Governance, admin |
| WALLET_CONTROLLER | Wallet operations | Governance |
| AUDITOR | Read-only admin surfaces | Write operations |

---

## 6. Delegation (Task 5)

Constrained delegation in `packages/identity/src/fine-grained/delegation.ts`:

```typescript
User → delegates to Financial Agent → permission to analyze investment data
```

**Does NOT grant:**

- withdraw funds
- change consent
- issue SunRey
- approve monetary governance

Delegation includes: `scope`, `purpose`, `expiration`, `revocation`.

Non-delegatable authorities: `HUMAN_GOVERNANCE`, `ADMINISTRATOR`, `VALIDATOR`, `MONETARY_ISSUANCE`, `CONSENT_MODIFICATION`, `PRODUCTION_ACTIVATION`.

---

## 7. Identity federation (Task 6)

### Keycloak evaluation: **Deferred**

Per ADR-0007:

- Lead candidate: Ory Kratos + Hydra per sovereign cell
- Fallback: Keycloak per cell (not shared cluster)
- Integration: `IdentityFederationPort` behind existing identity boundaries
- OIDC-shaped anti-corruption layer; Kernel consumes proofs, not vendor types

**Does not replace** pseudonymous economic identity with login identity.

---

## 8. Login vs economic identity (Task 7)

Separated identity planes in `packages/identity/src/fine-grained/identity-separation.ts`:

```
AuthenticationIdentity ≠ HumanEconomicIdentity ≠ WalletIdentity ≠ GovernanceIdentity ≠ ValidatorIdentity
```

Controlled links via `IdentityLinkRegistry`:

- `AUTHENTICATES` — login → session
- `BINDS_ECONOMIC` — login → pseudonymous economic identity
- `CONTROLS_WALLET` — subject → wallet
- `GOVERNANCE_PARTICIPANT` — ceremony binding
- `VALIDATOR_OPERATOR` — operator → validator key

Changing login identity does not alter economic identity.

---

## 9. Service-to-service authorization (Task 8)

Zero-trust service authorization in `packages/identity/src/fine-grained/admin-and-service.ts`:

- `evaluateServiceAuthorization()` — requires explicit `ServiceIdentity` + capability
- Internal network ≠ trusted
- Cross-service `ADMINISTER` denied without explicit binding

Extends `packages/security/src/identity.ts` `assertServiceCapability`.

---

## 10. Administrative authorization (Task 9)

Sensitive actions require explicit authorized roles (`SENSITIVE_ADMIN_ACTIONS`):

| Action | Required roles | Dual control |
| --- | --- | --- |
| PROVIDER_ENABLE | SECURITY_OPERATOR, PLATFORM_ADMIN | No |
| PROVIDER_DISABLE | SECURITY_OPERATOR, COMPLIANCE_MANAGER | Yes |
| POLICY_ACTIVATE | COMPLIANCE_MANAGER | Yes |
| IDENTITY_SUSPEND | COMPLIANCE_MANAGER, FRAUD_ANALYST | Yes |
| MANUAL_CLAIM_REVIEW | COMPLIANCE_ANALYST, COMPLIANCE_MANAGER | No |
| DOMAIN_CIRCUIT_BREAKER | SECURITY_OPERATOR, SRE_OPERATOR | Yes |
| VALIDATOR_CONFIGURE | SECURITY_OPERATOR | No |
| GOVERNANCE_CONFIGURE | COMPLIANCE_MANAGER | No |

No universal super-admin path. `PLATFORM_ADMIN` does not inherit all operational roles.

---

## 11. Tests (Task 10)

`packages/identity/src/fine-grained-authorization.test.ts`:

| Scenario | Expected |
| --- | --- |
| User accessing own resource | ALLOWED |
| User accessing another user's resource | RELATIONSHIP_MISSING |
| Agent delegated read | ALLOWED with delegation + ACTS_FOR |
| Agent unauthorized write | DENIED |
| Expired delegation | DELEGATION_DENIED |
| Revoked delegation | DELEGATION_DENIED |
| Service identity | ALLOWED with MAY_READ tuple |
| Wrong service | RELATIONSHIP_MISSING |
| Admin role separation | ADMIN_ROLE_REQUIRED |
| Validator cannot become governance | ACTOR_TYPE_MISMATCH |
| Governance cannot bypass transaction rules | MONETARY_BYPASS_FORBIDDEN |
| Login identity change preserves economic identity | economic ID unchanged |

---

## 12. File map

| Path | Purpose |
| --- | --- |
| `packages/identity/src/fine-grained/actor-types.ts` | Actor type taxonomy |
| `packages/identity/src/fine-grained/relationship-model.ts` | Tuple definitions |
| `packages/identity/src/fine-grained/delegation.ts` | Constrained delegation |
| `packages/identity/src/fine-grained/identity-separation.ts` | Identity plane separation |
| `packages/identity/src/fine-grained/interface.ts` | FineGrainedAuthorization port |
| `packages/identity/src/fine-grained/engine.ts` | SimulationRelationshipEngine |
| `packages/identity/src/fine-grained/admin-and-service.ts` | Admin + service auth |
| `packages/identity/src/fine-grained/federation.ts` | IdentityFederationPort |
| `packages/identity/src/fine-grained-authorization.test.ts` | Test suite |

---

## 13. Future work (not Wave 7 scope)

- Wire `SimulationRelationshipEngine` into `services/api` context builder
- Implement `OpenFgaAuthorizationAdapter` when ReBAC service is provisioned
- Implement `KeycloakIdentityFederation` per cell per ADR-0007
- Durable relationship tuple persistence
- Connect `CapabilityGrant.source: 'RELATIONSHIP'` to tuple store
