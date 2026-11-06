import { attachGenomeHash, computeStrategyGenomeHash, lineageWithoutGenomeHash } from '../os05/hash.ts';
import { buildOs05ExampleStrategyGenome } from '../os05/fixtures.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion } from '../os05/ids.ts';
import { STRATEGY_SCIENTIST_AGENT_ROLE, STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA } from './taxonomy.ts';
import type { GenomeProposal } from './types.ts';

function exampleGenomeForEvol12Proposal(): ReturnType<typeof buildOs05ExampleStrategyGenome> {
  const base = buildOs05ExampleStrategyGenome();
  const withoutHash = {
    ...base,
    genomeId: asStrategyGenomeId('sgnm_helios_evol12_strategy_scientist_example'),
    name: 'EVOL12 Strategy Scientist Example Genome',
  };
  return attachGenomeHash({
    ...withoutHash,
    lineage: lineageWithoutGenomeHash(withoutHash.lineage),
  });
}

/**
 * Valid GenomeProposal for tests and documentation (static validation + holdout seal;
 * evaluation and promotion remain outside the scientist boundary).
 */
export function buildEvol12SampleGenomeProposal(): GenomeProposal {
  const declarativeGenome = exampleGenomeForEvol12Proposal();
  const genomeMaterial = computeStrategyGenomeHash({
    ...declarativeGenome,
    lineage: lineageWithoutGenomeHash(declarativeGenome.lineage),
  });
  return Object.freeze({
    schema: STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA,
    proposalId: `evol12_prop_${genomeMaterial.slice(0, 16)}`,
    scientist: Object.freeze({
      role: STRATEGY_SCIENTIST_AGENT_ROLE,
      agentRef: 'agent/strategy-scientist/evol12_fixture',
    }),
    researchHypothesis: Object.freeze({
      hypothesisId: 'hyp_evol12_mean_reversion_vol_gate',
      statement: 'Mean reversion alpha concentrates when short-horizon realized vol is suppressed.',
      prediction: 'Positive paper uplift vs baseline when the vol gate is active.',
      negation: 'No uplift when the gate is inactive or vol is elevated.',
    }),
    mechanism: Object.freeze({
      kind: 'NEW_FEATURE_COMBINATION' as const,
      featureCombinationDescription: 'Pair realized-volatility feature with z-score mean-reversion signal.',
      regimeLogicDescription: 'Favor when macro stress proxy implies range-bound microstructure.',
    }),
    rationale: Object.freeze({
      economicRationale: 'Liquidity providers lean against dislocations in calm regimes.',
      expectedEdge: 'Capture partial mean reversion after liquidity-driven overshoot.',
      failureModes: Object.freeze(['Trend persistence', 'Volatility spike', 'Microstructure regime shift']),
      expectedRegime: 'Low realized vol, range-bound macro',
      requiredFeatures: Object.freeze(['feature.realized_volatility', 'signal.mean_reversion_zscore']),
      expectedHoldingHorizonDescription: 'Multi-day to two-week holding window.',
      falsifiableHypothesis: 'If edge exists, ablations removing the vol gate reduce risk-adjusted expectancy.',
    }),
    declarativeGenome,
    novelty: Object.freeze({
      mode: 'NOVEL',
      similarArchiveGenomeHashes: Object.freeze([]),
    }),
    suggestedExperiments: Object.freeze([
      'Ablate vol gate vs full genome on identical AAF partitions',
      'Swap execution preference to measure implementation shortfall sensitivity',
    ]),
    sealedHoldoutAccessDenied: true,
  });
}
