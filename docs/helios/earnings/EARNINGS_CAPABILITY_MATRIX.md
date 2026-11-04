# Earnings Capability Matrix

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

## External integration (subprocess gates)

| Integration | Verification |
|-------------|--------------|
| AAF V2 | `tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts` |
| Strategy Lab | Same AAF V2 final qualification harness |
| Execution Twin | `tests/helios-os02-execution-twin.test.ts` |
| Evidence Vault | Sealed in pipeline via `appendEarningsValidationEvidence` |
