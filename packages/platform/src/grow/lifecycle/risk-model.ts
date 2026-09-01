import type { FinancialRiskDimension } from './taxonomy.ts';
import type { OpportunityRiskLevel } from '../../growth/opportunity/taxonomy.ts';

export type RiskLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';

export type FinancialRiskProfile = {
  readonly dimensions: Readonly<Partial<Record<FinancialRiskDimension, RiskLevel>>>;
  readonly overall: OpportunityRiskLevel | 'UNKNOWN';
  readonly summary: string;
  readonly regulatoryScoreInvented: false;
  readonly modelProseOnly: false;
};

export function buildFinancialRiskProfile(input: {
  readonly market?: RiskLevel;
  readonly liquidity?: RiskLevel;
  readonly concentration?: RiskLevel;
  readonly credit?: RiskLevel;
  readonly currency?: RiskLevel;
  readonly duration?: RiskLevel;
  readonly volatility?: RiskLevel;
  readonly provider?: RiskLevel;
  readonly summary?: string;
}): FinancialRiskProfile {
  const dimensions = Object.freeze({
    ...(input.market ? { market: input.market } : {}),
    ...(input.liquidity ? { liquidity: input.liquidity } : {}),
    ...(input.concentration ? { concentration: input.concentration } : {}),
    ...(input.credit ? { credit: input.credit } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
    ...(input.duration ? { duration: input.duration } : {}),
    ...(input.volatility ? { volatility: input.volatility } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
  });
  const levels = Object.values(dimensions);
  const overall = deriveOverall(levels);
  return Object.freeze({
    dimensions,
    overall,
    summary: input.summary ?? 'Structured risk dimensions; not legal advice or regulatory scoring.',
    regulatoryScoreInvented: false,
    modelProseOnly: false,
  });
}

export function riskFromOpportunityLevel(level: OpportunityRiskLevel): FinancialRiskProfile {
  switch (level) {
    case 'LOW':
      return buildFinancialRiskProfile({
        market: 'LOW',
        liquidity: 'LOW',
        summary: 'Conservative cash or reserve movement.',
      });
    case 'MODERATE':
      return buildFinancialRiskProfile({
        market: 'MODERATE',
        liquidity: 'MODERATE',
        summary: 'Balanced allocation with bounded uncertainty.',
      });
    case 'HIGH':
      return buildFinancialRiskProfile({
        market: 'HIGH',
        liquidity: 'MODERATE',
        volatility: 'HIGH',
        summary: 'Higher uncertainty; suitability review required.',
      });
    case 'UNCERTAIN_MARKET':
      return Object.freeze({
        ...buildFinancialRiskProfile({
          market: 'HIGH',
          liquidity: 'UNKNOWN',
          volatility: 'HIGH',
          summary: 'Market outcome uncertain; projections are not realized returns.',
        }),
        overall: 'UNCERTAIN_MARKET' as const,
      });
    default: {
      const exhaustive: never = level;
      return exhaustive;
    }
  }
}

function deriveOverall(levels: readonly RiskLevel[]): OpportunityRiskLevel | 'UNKNOWN' {
  if (levels.length === 0) {
    return 'UNKNOWN';
  }
  if (levels.includes('HIGH')) {
    return 'HIGH';
  }
  if (levels.includes('MODERATE')) {
    return 'MODERATE';
  }
  if (levels.every((row) => row === 'LOW' || row === 'NONE')) {
    return 'LOW';
  }
  return 'UNKNOWN';
}
