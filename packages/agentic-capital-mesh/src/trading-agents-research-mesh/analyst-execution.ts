import type { AnalystReportBundle, TradingAgentsMeshRole } from './types.ts';
import { ANALYST_MESH_ROLES } from './types.ts';

export type AnalystExecutionSpec = {
  readonly role: TradingAgentsMeshRole;
  readonly reportKey: keyof AnalystReportBundle;
  readonly approvedTools: readonly string[];
};

const ANALYST_SPECS: readonly AnalystExecutionSpec[] = Object.freeze([
  Object.freeze({
    role: 'MARKET_ANALYST',
    reportKey: 'marketReport',
    approvedTools: Object.freeze(['getMarketSnapshot', 'getInstrumentMetadata']),
  }),
  Object.freeze({
    role: 'FUNDAMENTAL_ANALYST',
    reportKey: 'fundamentalReport',
    approvedTools: Object.freeze(['getInstrumentMetadata', 'getMandate']),
  }),
  Object.freeze({
    role: 'NEWS_ANALYST',
    reportKey: 'newsReport',
    approvedTools: Object.freeze(['getRdtReadiness']),
  }),
  Object.freeze({
    role: 'SENTIMENT_ANALYST',
    reportKey: 'sentimentReport',
    approvedTools: Object.freeze(['getEconomicValueSnapshot']),
  }),
  Object.freeze({
    role: 'TECHNICAL_ANALYST',
    reportKey: 'technicalReport',
    approvedTools: Object.freeze(['getMarketSnapshot', 'getRiskSnapshot']),
  }),
]);

export function buildAnalystExecutionPlan(
  selected: readonly TradingAgentsMeshRole[] = ANALYST_MESH_ROLES,
): readonly AnalystExecutionSpec[] {
  const set = new Set(selected);
  const plan = ANALYST_SPECS.filter((spec) => set.has(spec.role));
  if (plan.length === 0) {
    throw new Error('at least one analyst must be selected');
  }
  return Object.freeze(plan);
}

export function runAnalystPhaseParallel<T>(
  specs: readonly AnalystExecutionSpec[],
  runner: (spec: AnalystExecutionSpec) => T,
): readonly T[] {
  return Object.freeze(specs.map((spec) => runner(spec)));
}
