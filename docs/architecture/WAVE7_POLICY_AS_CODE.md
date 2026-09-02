# Wave 7 — Policy as Code

**Version:** 1.0.0-wave7  
**Status:** Architectural specification + simulation implementation  
**Owner:** `packages/kernel/src/policy` (regulatory policy), `packages/identity/src/fine-grained` (authorization)  
**Companion:** `docs/architecture/WAVE7_FINE_GRAINED_AUTHORIZATION.md`, `docs/architecture/adr/ADR-0006-policy-engine-language.md`

---

## 1. Two complementary layers

| Layer | Question | Owner | Implementation |
| --- | --- | --- | --- |
| **Policy** | Is this action allowed under jurisdiction, purpose, and consent rules? | Kernel policy engine, consent, purpose registry | `packages/kernel/src/policy`, `packages/consent` |
| **Authorization** | Does this principal possess the relationship/permission to attempt it? | Identity fine-grained authorization | `packages/identity/src/fine-grained` |

Both layers must pass for a mutation to proceed. Neither layer may be bypassed by the other.

```
Request → Authentication → Authorization (relationship) → Policy (purpose/jurisdiction) → Kernel → Execution Authority
```

---

## 2. Policy engine (ADR-0006 Option C)

The typed TypeScript policy engine in `packages/kernel/src/policy` evaluates jurisdiction packs with default-deny semantics. OPA/Rego integration remains deferred.

| Property | Value |
| --- | --- |
| Language | Typed TypeScript predicates |
| Packs | `packages/kernel/src/policy/packs/{us,eu,gb,sa,ae}.json` |
| Legal review | `CONFIRMED_BY_COUNSEL`, `DRAFT`, `RESEARCH_REQUIRED` |
| Production | Simulation only; unknown corridors `RESEARCH_REQUIRED` and disabled |

Policy answers regulatory and purpose questions. It does not replace relationship-based authorization.

---

## 3. Authorization engine (Wave 7)

Fine-grained authorization uses relationship tuples compatible with OpenFGA semantics:

```
subjectType:subjectId#relation@objectType:objectId
```

Implemented in simulation by `SimulationRelationshipEngine`. OpenFGA adapter port defined; runtime dependency deferred.

See `docs/architecture/WAVE7_FINE_GRAINED_AUTHORIZATION.md` for the full relationship model.

---

## 4. Integration points

| Surface | Policy check | Authorization check |
| --- | --- | --- |
| Consumer API | Kernel purpose/jurisdiction proofs | `AuthorizationContext` + ownership + relationships |
| Personal Data Vault | Purpose registry + consent port | `VaultAccessBroker` + `USER GRANTED CONSENT` |
| Agent proposals | Kernel (agent never executes) | `AGENT ACTS_FOR USER` + constrained delegation |
| Staff operations | SoD matrix | `ADMIN MANAGES DOMAIN` + role separation |
| Service mesh | N/A (internal) | `ServiceIdentity` + `SERVICE MAY_READ DATASET` |
| Monetary governance | `evaluateHumanGovernanceGate` | `HUMAN_GOVERNANCE MAY_AUTHORIZE MONETARY_PROPOSAL` |

---

## 5. Fail-closed principles

1. Missing relationship → `RELATIONSHIP_MISSING`
2. Missing policy proof → Kernel `BLOCK` / `REFUSE`
3. Expired or revoked delegation → `DELEGATION_DENIED`
4. Agent withdraw attempt → `MONETARY_BYPASS_FORBIDDEN`
5. Admin monetary bypass → `MONETARY_BYPASS_FORBIDDEN`
6. Validator attempting governance → `ACTOR_TYPE_MISMATCH`
7. Internal network ≠ trusted → service capability required

---

## 6. Deferred integrations

| Technology | Decision | Rationale |
| --- | --- | --- |
| OpenFGA | Deferred | Typed simulation engine adopted; adapter port ready |
| OPA/Rego | Deferred | ADR-0006 Option C implemented |
| Keycloak | Deferred | ADR-0007; integrate behind `IdentityFederationPort` per cell |

---

## 7. Tests

- `packages/identity/src/fine-grained-authorization.test.ts` — relationship, delegation, admin, service, identity separation
- `packages/identity/src/authorization.test.ts` — server-owned context, ownership IDOR
- `packages/identity/src/staff.test.ts` — admin role separation, SoD
- `packages/kernel/src/policy/policy.test.ts` — jurisdiction pack evaluation
- `tests/wave-6-prompt-17-security-assurance.test.ts` — auth regression

---

## Contract maintenance

Changes require:

1. Update tests in the matrix above
2. Architectural linter pass
3. No weakening of monetary authority boundaries (`SUNREY_MONETARY_AUTHORITY_CONTRACT.md`)
