import type { HeliosSpecialistRole, SpecialistNodeSpec } from './types.ts';

const READ_TOOLS = Object.freeze([
  'getPortfolio',
  'getMarketSnapshot',
  'getRiskSnapshot',
  'getMandate',
  'getGrowthPlan',
  'getInstrumentMetadata',
]);

function spec(
  role: HeliosSpecialistRole,
  objective: string,
  tools: readonly string[],
  provider: SpecialistNodeSpec['defaultProvider'],
  fallback: SpecialistNodeSpec['fallbackProvider'],
): SpecialistNodeSpec {
  return Object.freeze({
    role,
    objective,
    approvedTools: tools,
    inputSchema: `ResearchMeshInput/${role}`,
    outputSchema: 'SpecialistTaskOutput/v1',
    capabilityScope: Object.freeze(['research-only', 'no-execution', 'no-ledger']),
    defaultProvider: provider,
    fallbackProvider: fallback,
    researchBudgetCeilingMicros: 250_000n,
    timeoutMs: 30_000,
    maxIterations: 3,
    failureState: 'FAILED',
  });
}

export const DEFAULT_SPECIALIST_NODES: readonly SpecialistNodeSpec[] = Object.freeze([
  spec(
    'OPPORTUNITY_RESEARCH',
    'Scan approved sources and convert events into research hypotheses/candidates.',
    [...READ_TOOLS, 'getEconomicValueSnapshot'],
    'GROK',
    'S3M',
  ),
  spec(
    'MACRO_FX',
    'Assess rates, currencies, macro regimes and cross-asset conditions.',
    [...READ_TOOLS, 'getRdtReadiness'],
    'GROK',
    'S3M',
  ),
  spec(
    'STAT_ARB_RELATIVE_VALUE',
    'Quantify relative mispricing, spread relationships, correlation/dislocation.',
    [...READ_TOOLS],
    'LOCAL_DETERMINISTIC',
    null,
  ),
  spec(
    'VOLATILITY',
    'Assess volatility state, convexity, and surfaces where valid data exists.',
    ['getMarketSnapshot', 'getInstrumentMetadata'],
    'LOCAL_DETERMINISTIC',
    null,
  ),
  spec(
    'MICROSTRUCTURE',
    'Assess spread, liquidity, order-book conditions, adverse-selection where data exists.',
    ['getMarketSnapshot', 'getPortfolio'],
    'LOCAL_DETERMINISTIC',
    null,
  ),
  spec(
    'EXECUTION_RESEARCH',
    'Research route/timing/market-impact only. No unrestricted execution authority.',
    ['getMarketSnapshot', 'getPortfolio', 'getInstrumentMetadata'],
    'S3M',
    'LOCAL_DETERMINISTIC',
  ),
  spec(
    'EVIDENCE_VERIFIER',
    'Check whether claimed facts have adequate evidence/provenance/freshness.',
    READ_TOOLS,
    'LOCAL_DETERMINISTIC',
    null,
  ),
  spec(
    'ADVERSARIAL_CRITIC',
    'Search for reasons the candidate/strategy is wrong.',
    READ_TOOLS,
    'S3M',
    null,
  ),
  spec(
    'META_ALLOCATOR',
    'Aggregate specialist outputs into a bounded recommendation for further research or proposal consideration.',
    [],
    'LOCAL_DETERMINISTIC',
    null,
  ),
]);

export function nodeSpecForRole(role: HeliosSpecialistRole): SpecialistNodeSpec {
  const found = DEFAULT_SPECIALIST_NODES.find((node) => node.role === role);
  if (!found) {
    throw new Error(`specialist role ${role} is not registered`);
  }
  return found;
}
