# Earnings Capability Matrix

**Git SHA:** `fa6d4ab2456371029a4a3d73f77702dddf2f0ab6`  
**Qualification (UTC):** 2026-11-04T14:17:06.366Z  
**Stack marker:** `HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED`  
**Reality gate:** `ARCHITECTURALLY_QUALIFIED` (simulation fixture; no alpha tier promotion)

| Capability | Owner module | Benchmarks | Regime slices | PIT / embargo |
|-----------|--------------|------------|---------------|---------------|
| Earnings calendar | `earn01-domain.ts` | All strategies | All | Scheduled vs report knowable times |
| Event graph | `earn02-event-graph.ts` | HELIOS_FULL_STACK | Sector | Node `knowableAt` |
| Surprise tensor | `earn03-surprise-tensor.ts` | vs CONSENSUS_ONLY | Cap tier | Pre-report only |
| Analyst revisions | `earn04-analyst-expectations.ts` | ROBUST_CONSENSUS | Coverage | Revision flag |
| Transcript tone | `earn05-transcript-intelligence.ts` | TRANSCRIPT_ONLY | Liquidity | Pre-decision flag |
| Quality | `earn06-earnings-quality.ts` | FUNDAMENTALS_ONLY | Volatility | Accounting inputs |
| Options state | `earn07-options-intelligence.ts` | OPTIONS_ONLY | Volatility | Pre-event flag |
| Peer / PEAD | `earn08-peer-attention-pead.ts` | FULL_ENSEMBLE | Sector | Peer history |
| Estimator | `earn09-probabilistic-estimator.ts` | HELIOS_FULL_STACK | All | Consensus anchor |
| Committee | `earn10-agent-committee.ts` | HELIOS_FULL_STACK | All | Weighted votes |
| Strategy Genome | `earn11-strategy-genome.ts` | HELIOS_FULL_STACK | All | Feature flags |
| Qualification | `qualification.ts` | 8 baselines + HELIOS | 14 slice types | EARN12 gate |

## Holdout summary (EARN12 fixture)

| Split | Events |
|-------|-------:|
| Train | 28 |
| Validation | 10 |
| Holdout | 10 |
| Walk-forward folds | 5 |

## External integration (subprocess gates)

| Integration | Verification | HEALTH01 run |
|-------------|--------------|--------------|
| AAF V2 | `tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts` | PASS |
| Strategy Lab | Same AAF V2 final qualification harness | PASS |
| Execution Twin | `tests/helios-os02-execution-twin.test.ts` | PASS |
| Evidence Vault | Sealed in pipeline via `appendEarningsValidationEvidence` | PASS (in-test) |

## EARN test coverage (current main)

| Work package | Primary test entry |
|-------------|-------------------|
| EARN01 | `tests/helios-earn01-earnings-intelligence-domain.test.ts` |
| EARN02 | `tests/helios-earn02-point-in-time-earnings-event-graph.test.ts` |
| EARN03 | `tests/helios-earn03-surprise-tensor.test.ts` |
| EARN04 | `tests/helios-earn04-analyst-expectations.test.ts` |
| EARN05 | `tests/helios-earn05-transcript-mesh-bridge.test.ts` |
| EARN06 | `tests/helios-earn06-earnings-quality.test.ts` |
| EARN07 | `packages/platform/src/helios/earnings-intelligence/options/options-earnings.test.ts` |
| EARN08 | `tests/helios-earn08-event-network.test.ts` |
| EARN09 | `tests/helios-earn09-probabilistic-state-estimator.test.ts` |
| EARN10 | `tests/helios-earn10-agentic-earnings-committee.test.ts` |
| EARN11 | `tests/helios-earn11-strategy-research.test.ts` |
| EARN12 | `tests/helios-earn12-earnings-intelligence-qualification.test.ts` + `earn12-qualification.test.ts` |

Combined EARN harness: **77 tests, 0 failures** (2026-11-04 HEALTH01 run).
