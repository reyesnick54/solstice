# SunRey Monetary Authority Contract

**Version:** 1.0.0-wave1  
**Status:** Architectural specification (Wave 1)  
**Owner:** `packages/sunrey-chain` (Chunk 71 monetary constitution)  
**Companion:** `docs/architecture/WAVE1_AUTHORITY_AUDIT.md`, `docs/architecture/WAVE1_REPOSITORY_BASELINE.md`

---

## 1. Canonical Monetary Authority

The **canonical monetary authority** for `SUNREY_COIN` and `MOONREY_COIN` is the `AssetSupplyBook` in `packages/sunrey-chain/src/economics/supply.ts`, mutated only through:

1. **Issuance** — `authorizeIssuance()` in `packages/sunrey-chain/src/economics/issuance.ts`
2. **Burn** — `burn()` / `burnReservedFee()` in `packages/sunrey-chain/src/economics/operations.ts`

The productized facade is `ProtocolNativeSupplyAuthority` (`packages/sunrey-chain/src/native-assets/economic-controls.ts`).

**Conservation identity (integer minor units, no floating point):**

```
genesisAllocated + issuedPostGenesis - burned
  = circulating + locked + escrowed + feeReserved
```

Transfers, locks, escrows, and fee reserves redistribute supply; they do not change total supply.

No other component — database, API, Exchange, Agent, oracle, frontend, or operational service — may establish canonical native supply truth.

---

## 2. Permitted Supply Actors

| Actor | May execute issuance | May execute burn | Enforcement |
|-------|---------------------|------------------|-------------|
| `PROTOCOL` | Yes (via `authorizeIssuance` with valid `MonetaryIssuanceAuthority`) | Yes (via `authorizedBurn`) | `refuseForbiddenMutator` returns null |
| `HUMAN_GOVERNANCE` | Yes (with governance evidence on MAINNET) | Yes (policy-dependent) | `evaluateHumanGovernanceGate` |

All issuance requires a signed `MonetaryIssuanceAuthority` draft that passes `authorizeIssuance` gates: permitted issuance class, positive quantity within ceiling, replay identifier uniqueness, asset-specific evidence, and production firewall checks.

---

## 3. Forbidden Supply Actors

The following actors are **structurally forbidden** from mutating canonical supply via `ProtocolNativeSupplyAuthority`:

| Actor | Code rejection |
|-------|----------------|
| `EXCHANGE_DATABASE` | `UNAUTHORIZED_ACTOR` |
| `FRONTEND` | `UNAUTHORIZED_ACTOR` |
| `AGENT` | `UNAUTHORIZED_ACTOR` |
| `AI` | `UNAUTHORIZED_ACTOR` / `AI_MONETARY_AUTHORIZATION_REJECTED` |
| `ORACLE` | `UNAUTHORIZED_ACTOR` |
| `OPERATIONAL_DATABASE` | `UNAUTHORIZED_ACTOR` |

Defined in `FORBIDDEN_SUPPLY_MUTATORS` (`economic-controls.ts`). Consumer BFF, Agent tool catalog, and custody contracts align with this list but do not themselves enforce supply mutation — enforcement occurs at the supply authority boundary.

---

## 4. Human Governance Boundary

Human governance is required for:

- **MAINNET** issuance proposals (`createIssuanceProposal` → `AWAITING_GOVERNANCE`)
- **MAINNET** economic parameter authorization (Chunks 143–165 ceremony chain)
- Production genesis allocation (currently zero; `evaluateGenesisAllocation` blocks non-zero mainnet)

Governance evidence must include: `decisionId`, `documentVersion`, `documentHash`, `effectiveAtUtc`, `signatureOrReference`, `authorizedBy: 'HUMAN_GOVERNANCE'`, `aiApproved: false`.

Development and testnet paths accept labeled simulation governance (`DEVELOPMENT_OR_TESTNET_ONLY` reference) but **cannot** authorize production economics.

---

## 5. AI Authority Boundary

AI and Agent actors:

- Cannot pass `refuseForbiddenMutator` as supply actors
- Cannot set `actorKind: 'AI' | 'AGENT'` on `MonetaryIssuanceAuthority` (`AI_MONETARY_AUTHORIZATION_REJECTED`)
- Cannot self-approve issuance proposals (`createIssuanceProposal` throws on `aiAttemptedApproval`)
- Cannot authorize human contribution settlement (`HumanContributionMonetaryBridge` rejects AI/AGENT/S3M/GROK/MODEL)
- Cannot appear in Agent tool catalog as mint/burn/policy-modify tools

`ALLOW` from Kernel for agent-originated intents means "fit for human consideration" — never Execution Authority for monetary mutation.

---

## 6. Oracle Authority Boundary

Oracles may **observe** economic reality. They may not mint.

Enforcement:

- `rejectOracleOnlyMint()` → `ORACLE_OBSERVATION_CANNOT_MINT`
- `evaluateOracleSafety()` rejects INVALID, STALE, DISPUTED, and single-source observations
- `runMoonReyIssuancePipeline` requires productive authorization beyond oracle observations
- `MoonReyProductiveSettlementBridge.refuseStandaloneAttempt('ORACLE_OBSERVATION')` → `ORACLE_OBSERVATION_ALONE_CANNOT_ISSUE`
- Chunk 150 external provider candidates: injected transports only; production inactive

Configured provider ≠ trusted provider. Certification (`src/oracle/production/certification`) is admission gate, not mint authority.

---

## 7. Database Authority Boundary

| Database / store | Role | Supply authority |
|------------------|------|------------------|
| PostgreSQL (operational) | Persistence, recovery | **None** — `postgresCannotMutateAssetSupplyBook: true` |
| Evidence Vault | Hash-chained audit | **None** — append-only evidence |
| Fiat ledger (`packages/ledger`) | Customer money journals | **None for native supply** — separate plane |
| Exchange DB / in-memory | Order books, simulation balances | **None** — `isAssetSupplyBook: false` |
| Custody provider state | Holdings reconciliation | **None** — not canonical supply |

Recovery rehydration must not overwrite `AssetSupplyBook`. Corruption fails closed.

---

## 8. Exchange Authority Boundary

The Exchange may:

- Match orders and record last trade price
- Hold simulation coin balances (`InMemoryCoinPort`, `InMemoryNativeChain`)
- Settle trades against custody simulation

The Exchange may **not**:

- Mutate `AssetSupplyBook`
- Authorize native issuance
- Treat market price as protocol valuation (`separateValuationFromMarketPrice` → `valuationDoesNotSetPrice: true`)

Red-team probe `direct_supply_mutation` expects `UNAUTHORIZED_ISSUANCE`.

---

## 9. Valuation vs Monetary Policy

| Concept | Examples | May mint? |
|---------|----------|-----------|
| Economic fact | Oracle observation, HIN contribution, productive claim | No |
| Verification | Contribution verified, observation certified | No |
| Valuation | PEVE output, HIN valuation, GPUV, reference value | No |
| Monetary policy | Issuance class, ceiling, epoch cap, governance decision | Gates mint |
| Coin quantity | `issuedPostGenesis`, `genesisAllocated` | Canonical truth |

`referenceValue` on `HumanEconomicEvidence` is informational — `authorizedSunReyQuantity` on settlement authorization is the separately authorized quantity.

PEVE / GPUV / productive value **do not automatically equal** coin quantity.

---

## 10. Monetary Policy vs Exchange Price

- Protocol valuation (`ProtocolValuationInput`) has `isExchangeMarketPrice: false`
- Exchange last trade is labeled `LAST_TRADE_NOT_GUARANTEED`
- Consumer BFF returns `valuationDoesNotSetPrice: true`
- GPUV and human contribution bridge outputs explicitly state they are not market price

Market price discovery is an Exchange concern. Monetary policy is a protocol governance concern. No fixed SunRey/MoonRey ratio.

---

## 11. SunRey Issuance Invariants

| Invariant | Enforced | Location |
|-----------|----------|----------|
| Raw personal data cannot mint | **Yes** | `privacySafeHumanEvidence` throws; `FORBIDDEN_PERSONAL_KEYS`; pipeline `RAW_USER_DATA`; `authorizeIssuance` `RAW_PERSONAL_DATA_REJECTED` |
| Contribution event cannot directly mint | **Yes** | `HumanContributionMonetaryBridge` requires settlement authorization |
| Unverified contribution cannot mint | **Yes** | `validateVerifiedContribution`; pipeline `UNVERIFIED_CONTRIBUTION` |
| AI-generated valuation cannot mint | **Yes** | Pipeline `AI_VALUATION_CANNOT_MINT`; bridge AI/AGENT/S3M/GROK/MODEL rejections |
| PEVE output ≠ coin quantity | **Yes** | `refuseStandaloneAttempt('PEVE_SCORE')` → `PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY` |
| Contribution eligibility ≠ issuance | **Yes** | Settlement authorization required; `SETTLEMENT_AUTHORIZATION_REQUIRED` |
| Consent distinguishable from valuation | **Yes** | `CONSENT_ALONE_CANNOT_ISSUE`, `HIN_CONSENT_ALONE_CANNOT_ISSUE` |
| Purpose authorization distinguishable from monetary authorization | **Yes** | `purposeClass` on evidence vs `MonetaryIssuanceAuthority` |
| Governance required (mainnet) | **Yes** | `evaluateHumanGovernanceGate`, `MAINNET_ECONOMICS_NOT_AUTHORIZED` |
| AI cannot self-approve governance | **Yes** | `AI_CANNOT_APPROVE`, `rejectAiActivation` |
| Replay of same contribution cannot repeat issuance | **Yes** | `usedReplayIds`, `settledReplayKeys`, `DUPLICATE_ISSUANCE`, `DUPLICATE_CONTRIBUTION_SETTLEMENT` |
| Issuance reconciles to canonical supply | **Yes** | `supplyReconciles`, `enforceSupplyInvariants` post-issuance |

**SunRey path:** Verified contribution → settlement authorization → `developmentSunReyAuthority` → `authorizeIssuance` → `creditCirculating`.

---

## 12. MoonRey Issuance Invariants

| Invariant | Enforced | Location |
|-----------|----------|----------|
| Raw oracle observation cannot mint | **Yes** | `rejectOracleOnlyMint`, `evaluateOracleSafety`, bridge standalone refusal |
| Single-source observation cannot mint | **Yes** | `SINGLE_ORACLE_CANNOT_MINT` |
| Configured provider ≠ trusted provider | **Partial** | Certification gate exists; no auto-mint on configure (convention + schema) |
| Verified observation ≠ productive contribution | **Yes** | Productive engine `verifyClaim`; evidence class `VERIFIED_PRODUCTIVE_CONTRIBUTION` |
| Productive contribution ≠ GPUV | **Yes** | Separate pipeline stages; `GPUV_ALONE_CANNOT_ISSUE` |
| GPUV ≠ MoonRey quantity | **Yes** | `createProductiveSettlementAuthorization` separates conversion |
| GPUV ≠ Exchange price | **Yes** | `separateValuationFromMarketPrice` |
| Productive valuation ≠ monetary supply | **Yes** | Settlement bridge → `authorizeIssuance` only after full chain |
| Market price ≠ monetary supply | **Yes** | Exchange isolation; no mint from trade |
| Stale/disputed/invalid observations cannot authorize issuance | **Yes** | `evaluateOracleSafety` |
| AI cannot self-authorize issuance | **Yes** | Same AI boundary as SunRey |
| Governance required | **Yes** | `evaluateHumanGovernanceGate`; production candidate blocks |
| Replay/double counting controlled | **Yes** (simulation) | `ProductiveSettlementBook`, `REPLAY_REJECTED`, `usedReplayIds` |
| Production issuance disabled | **Yes** | `PRODUCTION_ISSUANCE_UNCONFIGURED`, `PRODUCTION_V2_UNAVAILABLE`, `productionIssuanceActivated: false` |

**MoonRey path (V2):** Productive claim → attribution → productive value (GPUV) → settlement authorization → `governedValueMoonReyAuthority` → `authorizeIssuance`.

---

## 13. Supply Invariants

| Invariant | Enforced | Test |
|-----------|----------|------|
| `supply >= 0` | **Yes** | `enforceSupplyInvariants` `NEGATIVE_SUPPLY`; `economics.test.ts` |
| Circulating ≤ total supply | **Yes** | Conservation identity + position sums |
| Wallet holdings ≤ valid issued supply | **Yes** | `WALLET_EXCEEDS_SUPPLY` in `enforceSupplyInvariants` |
| Sum of holdings reconciles with supply model | **Yes** | `supplyReconciles` |
| Burned supply cannot reappear | **Yes** | Burns only increase `burned`; no decrement path |
| No unauthorized actor may alter supply | **Yes** | `refuseForbiddenMutator`; `productization.test.ts` |
| No unsigned governance for mainnet issuance | **Yes** | `MISSING_GOVERNANCE`, `MAINNET_ECONOMICS_NOT_AUTHORIZED` |
| No AI impersonating human governance | **Yes** | `aiApproved: false` required; `AI_CANNOT_APPROVE` |
| Duplicate transaction cannot execute twice | **Partial** | Issuance/burn replay IDs; transfer has no replay gate |
| Duplicate issuance authorization cannot execute twice | **Yes** | `usedReplayIds`, `DUPLICATE_ISSUANCE` |
| Network/environment gates cannot accidentally authorize production | **Yes** | `simulationCannotAuthorizeProduction`, production firewall, `LIVE_*` checks |

Additional invariants:

- Source and live supply classes never overlap (`assertNoDoubleCount`)
- Validator misconduct cannot burn unrelated customer assets (`VALIDATOR_MISCONDUCT_CUSTOMER_BURN_FORBIDDEN`)
- Genesis mainnet allocation is zero (`evaluateGenesisAllocation` `MAINNET_GENESIS_BLOCKED`)
- Testnet cannot become mainnet (`TESTNET_CANNOT_BECOME_MAINNET`)

---

## 14. Environment/Mainnet Safety Gates

| Gate | Mechanism |
|------|-----------|
| Simulation only | `ENVIRONMENT=simulation`, `LIVE_*=false` |
| Production parameters unconfigured | `PRODUCTION_PARAMETER_UNCONFIGURED` |
| Production issuance not activated | `productionIssuanceActivated: false` |
| Mainnet economics unauthorized | `mainnetEconomicsMissing()`, `ECONOMIC_PARAMETER_NOT_AUTHORIZED` |
| ProtocolNativeSupplyAuthority MAINNET block | Returns `MAINNET_ECONOMICS_NOT_AUTHORIZED` on `applyIssuance` |
| Production activation firewall | Chunk 143 evaluator — does not activate |
| Launch freeze / ceremony | Chunks 164–165 — freeze ≠ activation |
| Staged activation | Chunk 166 — rehearsal only |

Engineering simulation (`ENGINEERING_SIMULATION`) explicitly `becomesProductionConfiguration: false`.

---

## 15. Replay and Idempotency Requirements

**Issuance:** `replayIdentifier` scoped as `{assetId}:{issuanceClass}:{replayIdentifier}` in `usedReplayIds`.

**Burn:** `BURN:{assetId}:{replayIdentifier}` in `usedReplayIds`.

**Human contribution settlement:** `replayKeyOf(fingerprint, authorizationId, [valuationId, conversionPolicyVersion])` in `settledReplayKeys`.

**MoonRey V2 settlement:** `settledFingerprints`, `settledValueIds`, `settledValueDigests`, `settledEventIds`.

**Required future (Wave 2+):** Consensus-level transaction deduplication, cross-node replay protection, durable `usedReplayIds` persistence with crash recovery.

---

## 16. Required Future Consensus Guarantees

Not implemented in Wave 1. Required before mainnet native economics:

1. Validator-quorum confirmation of `MonetaryIssuanceAuthority` before book commit
2. Durable, replicated `AssetSupplyBook` state with fork-choice rules
3. Block-height/time-domain binding for `replayIdentifier` epochs
4. Slashing/evidence for unauthorized supply mutation attempts
5. Cross-check between custody holdings and canonical supply at consensus layer
6. Governance ceremony transcripts bound to issuance parameter hashes (Chunks 164–165)
7. No rehearsal fixture path (`creditCirculating` direct mutation) in production binaries

---

## 17. Fail-Closed Principles

1. **Unknown asset** → `INVENTED_ASSET`
2. **Missing authorization** → `UNRESTRICTED_MINT_UNAVAILABLE`
3. **Any forbidden actor** → `UNAUTHORIZED_ACTOR` (no fallback path)
4. **Kernel refusal** → returned unchanged; never caught and proceeded
5. **Production unconfigured** → `PRODUCTION_ISSUANCE_UNCONFIGURED` (not silent allow)
6. **Invariant violation post-mutation** → rollback (immutable book clone pattern)
7. **Oracle alone** → always refuse mint
8. **Valuation alone** → always refuse mint
9. **Consent/PDV/clean room alone** → always refuse mint
10. **Mainnet without governance evidence** → `MISSING_GOVERNANCE`

When in doubt, the system refuses. Refusal is sealed in the Evidence Vault where the Kernel is involved.

---

## Contract maintenance

Changes to this contract require:

1. Update to `docs/architecture/manifest.json` protected component metadata if authority ownership shifts
2. New or updated tests in the invariant-to-test matrix (`WAVE1_AUTHORITY_AUDIT.md` § Test Mapping)
3. Architectural linter / constitution check pass
4. Human review for any change that weakens a HARD PREVENTED boundary

**Wave 1 scope ends here.** Implementation of missing consensus guarantees is Wave 2+.
