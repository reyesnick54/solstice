# Wave 5 Prompt 15 — Grow My Money End-to-End Agentic Financial Lifecycle

Date: 2026-08-31  
Status: **Implemented (simulation); live execution provider-gated**

## Executive summary

Wave 5 Prompt 15 completes the truthful Grow My Money lifecycle map from
discovery through audit. The repository already contained Phase E Grow
orchestration, opportunity detectors, proposal immutability, Kernel-gated
investment execution (sandbox), and agent tool boundaries. This prompt adds
canonical lifecycle models, execution adapter contracts, data freshness
controls, structured risk representation, capability matrix, build-status
truth labels, financial-agent evaluation extensions, and deterministic E2E
scenarios A–F.

**Nothing in this prompt marks simulated execution as live.** Where a regulated
broker or bank is not connected, execution stops at `PROVIDER_REQUIRED` or
`PROVIDER_UNAVAILABLE`.

## Architecture

```text
Data Sources (PEG, ledger, mandate, market research, Wave 5 physical context)
      ↓
Opportunity Engine (packages/platform/src/growth/opportunity)
      ↓ normalizeFinancialOpportunity()
Financial Agent (detector-mapped Grow agents — see capability matrix)
      ↓ deterministic analysis (packages/platform/src/grow/lifecycle/analysis-engine.ts)
Analysis + structured risk (FinancialRiskProfile)
      ↓
Proposal (GrowLifecycleService / FinancialProposal — server-owned, versioned)
      ↓ evaluateGrowComplianceCheckpoint()
Compliance / suitability / Kernel
      ↓ recordApproval() — human only, binds proposalId + version + contentHash
User Authorization (step-up when required)
      ↓ createExecutionCommand() — NOT agent-callable
Execution Service (Consumer BFF + InvestmentsService + provider runtime)
      ↓ submitExecution() via GrowExecutionAdapter
Regulated Provider (sandbox INVESTMENT.PAPER_ORDER only in simulation)
      ↓ provider evidence
Confirmation (COMPLETED only after fill/settlement evidence)
      ↓
Ledger / Portfolio (canonical InvestmentsService + ledger reads)
      ↓ runMonitoringCycle()
Monitoring → shouldReassess() → new proposal (never silent trade)
      ↓ Evidence Vault + grow audit events
Audit
```

### Where AI exists vs trusted services

| Stage | AI role | Trusted deterministic service |
| --- | --- | --- |
| Explain opportunity | S3M may explain PEG facts | Opportunity detectors + ranking |
| Scenario narrative | May summarize assumptions | `buildGrowScenarios`, Money calculators |
| Proposal creation | Agent may request via read-only tools | `GrowLifecycleService.generateProposal` |
| Approval | **Forbidden** | `recordApproval` (CUSTOMER/HUMAN_OPERATOR) |
| Execution | **Forbidden** | Kernel + InvestmentsService + provider adapter |
| Monitoring | May explain findings | `runMonitoringCycle`, ledger/portfolio reads |

## Grow agents discovered

See `docs/productization/grow-agent-capability-matrix.json` and
`packages/platform/src/grow/lifecycle/agent-inventory.ts`.

| Agent | Discover | Analyze | Propose | Authorize | Execute | Monitor |
| --- | --- | --- | --- | --- | --- | --- |
| savings | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | SIMULATED | IMPLEMENTED |
| cash_optimization | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | SIMULATED | IMPLEMENTED |
| investment | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | PROVIDER_GATED | PARTIAL |
| debt | PARTIAL | PARTIAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| income_opportunity | PARTIAL | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | PROVIDER_GATED | PARTIAL |
| subscription_savings | IMPLEMENTED | IMPLEMENTED | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL |
| resource_exposure | PARTIAL | PARTIAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL |
| real_estate | PARTIAL | PARTIAL | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL |
| travel_savings | PARTIAL | PARTIAL | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL |
| portfolio_monitoring | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | PROVIDER_GATED | IMPLEMENTED |

## Canonical models

- **FinancialOpportunity** — `packages/platform/src/grow/lifecycle/financial-opportunity.ts`
- **CanonicalFinancialProposal** — `packages/platform/src/grow/lifecycle/financial-proposal-model.ts`
- **FinancialRiskProfile** — `packages/platform/src/grow/lifecycle/risk-model.ts`
- **SourcedFact / freshness** — `packages/platform/src/grow/lifecycle/data-freshness.ts`
- **GrowExecutionAdapter** — `packages/platform/src/grow/lifecycle/execution-adapter.ts`

## Portfolio accounting boundary

Authoritative sources consumed by Grow agents:

| State | Authority |
| --- | --- |
| Cash | Canonical ledger via Accounts service |
| Positions | InvestmentsService portfolio valuation |
| Transactions | Ledger journals (authority-required posts) |
| SunRey / MoonRey assets | Custody + chain owners (read-only to Grow) |

Grow agents do not maintain a shadow balance book.

## Tests

- `tests/wave-5-prompt-15-grow-lifecycle.test.ts` — scenarios A–F + model guards
- `tests/phase-e-grow-e2e.test.ts` — Consumer BFF happy path (existing)
- `packages/platform/src/grow/grow.test.ts` — proposal versioning (existing)
- `packages/sunrey-agent/src/productization-evaluations.test.ts` — extended Grow eval cases

## Remaining provider / regulatory dependencies

- Live investment broker adapter (production `INVESTMENT.PAPER_ORDER` or equivalent)
- Live banking rails for cash sweep / recurring ACH (payments owner)
- Jurisdiction-specific product activation matrix (Chunk 161 operating scope)
- Counsel-confirmed suitability rules per corridor (`RESEARCH_REQUIRED` corridors stay disabled)
- Production provider runtime authorization (`PRODUCTION_AUTHORIZED` remains false)
