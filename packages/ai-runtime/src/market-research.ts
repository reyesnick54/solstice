import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AiProviderFailure } from './types.ts';

export type MarketOpportunityCandidate = {
  readonly candidateId: string;
  readonly assetId: string;
  readonly symbol: string;
  readonly assetName: string;
  readonly assetClass: string;
  readonly market: string;
  readonly currency: string;
  readonly strategyClasses: readonly string[];
  readonly timeHorizon: string;
  readonly thesis: string;
  readonly catalysts: readonly string[];
  readonly risks: readonly string[];
  readonly evidence: readonly string[];
  readonly liquidityScoreBps: number;
  readonly momentumScoreBps: number;
  readonly fundamentalScoreBps: number;
  readonly catalystScoreBps: number;
  readonly sentimentScoreBps: number;
  readonly riskScoreBps: number;
  readonly confidenceBps: number;
  readonly downsideScenarioBps: number;
  readonly baseScenarioBps: number;
  readonly upsideScenarioBps: number;
  readonly asOf: string;
  readonly sourceRefs: readonly string[];
};

export type MarketOpportunityResearchResult = {
  readonly schemaVersion: 'sunrey.market-opportunity-research.v1';
  readonly generatedAt: string;
  readonly marketRegime: string;
  readonly candidates: readonly MarketOpportunityCandidate[];
  readonly warnings: readonly string[];
};

export const MARKET_RESEARCH_THRESHOLDS = Object.freeze({
  minimumEvidence: 2,
  minimumLiquidityScoreBps: 5_000,
  maximumRiskScoreBps: 7_500,
  minimumConfidenceBps: 5_000,
  maximumDownsideScenarioBps: -5_000,
  maxStalenessMs: 7 * 24 * 60 * 60 * 1000,
});

export function isCandidateEligibleForRanking(candidate: MarketOpportunityCandidate, now: string): boolean {
  return candidate.evidence.length >= MARKET_RESEARCH_THRESHOLDS.minimumEvidence &&
    candidate.sourceRefs.length >= MARKET_RESEARCH_THRESHOLDS.minimumEvidence &&
    candidate.liquidityScoreBps >= MARKET_RESEARCH_THRESHOLDS.minimumLiquidityScoreBps &&
    candidate.riskScoreBps <= MARKET_RESEARCH_THRESHOLDS.maximumRiskScoreBps &&
    candidate.confidenceBps >= MARKET_RESEARCH_THRESHOLDS.minimumConfidenceBps &&
    candidate.downsideScenarioBps >= MARKET_RESEARCH_THRESHOLDS.maximumDownsideScenarioBps &&
    Date.parse(now) - Date.parse(candidate.asOf) <= MARKET_RESEARCH_THRESHOLDS.maxStalenessMs;
}

const SCORE_FIELDS = [
  'liquidityScoreBps',
  'momentumScoreBps',
  'fundamentalScoreBps',
  'catalystScoreBps',
  'sentimentScoreBps',
  'riskScoreBps',
  'confidenceBps',
] as const;
const REQUIRED_CANDIDATE_FIELDS = [
  'candidateId', 'assetId', 'symbol', 'assetName', 'assetClass', 'market', 'currency',
  'timeHorizon', 'thesis', 'asOf',
] as const;

export function parseMarketOpportunityResearch(
  value: unknown,
): Result<MarketOpportunityResearchResult, AiProviderFailure> {
  if (!value || typeof value !== 'object') return invalid('research result must be an object');
  const root = value as Record<string, unknown>;
  if (root.guaranteedReturn !== undefined || root.guaranteedProfit !== undefined || root.guaranteedYield !== undefined) {
    return invalid('guaranteed outcome fields are forbidden');
  }
  if (root.schemaVersion !== 'sunrey.market-opportunity-research.v1') return invalid('unsupported research schema');
  if (!isIsoDate(root.generatedAt) || typeof root.marketRegime !== 'string' || !Array.isArray(root.candidates)) {
    return invalid('generatedAt, marketRegime, and candidates are required');
  }
  const candidates: MarketOpportunityCandidate[] = [];
  for (const [index, raw] of root.candidates.entries()) {
    const parsed = parseCandidate(raw, index);
    if (!parsed.ok) return parsed;
    candidates.push(parsed.value);
  }
  const warnings = root.warnings === undefined ? [] : root.warnings;
  if (!Array.isArray(warnings) || warnings.some((item) => typeof item !== 'string')) return invalid('warnings must be strings');
  return ok(Object.freeze({
    schemaVersion: root.schemaVersion,
    generatedAt: root.generatedAt,
    marketRegime: root.marketRegime,
    candidates: Object.freeze(candidates),
    warnings: Object.freeze(warnings),
  }));
}

function parseCandidate(value: unknown, index: number): Result<MarketOpportunityCandidate, AiProviderFailure> {
  if (!value || typeof value !== 'object') return invalid(`candidates[${index}] must be an object`);
  const item = value as Record<string, unknown>;
  if ('guaranteedReturn' in item || 'guaranteedProfit' in item || 'guaranteedYield' in item) {
    return invalid(`candidates[${index}] contains a forbidden guarantee field`);
  }
  for (const field of REQUIRED_CANDIDATE_FIELDS) {
    if (typeof item[field] !== 'string' || item[field].length === 0) return invalid(`candidates[${index}].${field} is required`);
  }
  if (!isIsoDate(item.asOf)) return invalid(`candidates[${index}].asOf must be an ISO timestamp`);
  for (const field of ['strategyClasses', 'catalysts', 'risks', 'evidence', 'sourceRefs']) {
    const values = item[field];
    if (!Array.isArray(values) || values.some((entry) => typeof entry !== 'string')) return invalid(`candidates[${index}].${field} must be string[]`);
  }
  const evidence = item.evidence as unknown[];
  const sourceRefs = item.sourceRefs as unknown[];
  if (evidence.length === 0 || sourceRefs.length === 0) return invalid(`candidates[${index}] requires evidence and sourceRefs`);
  for (const field of SCORE_FIELDS) {
    const score = item[field];
    if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0 || score > 10_000) return invalid(`${field} must be an integer in [0,10000]`);
  }
  for (const field of ['downsideScenarioBps', 'baseScenarioBps', 'upsideScenarioBps']) {
    const scenario = item[field];
    if (typeof scenario !== 'number' || !Number.isSafeInteger(scenario) || scenario < -1_000_000 || scenario > 1_000_000) return invalid(`${field} must be a signed integer basis-point scenario`);
  }
  return ok(Object.freeze(item as unknown as MarketOpportunityCandidate));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function invalid(detail: string): Result<never, AiProviderFailure> {
  return err({ ok: false, code: 'INVALID_STRUCTURED_OUTPUT', detail, providerKind: 'XAI_GROK' });
}
