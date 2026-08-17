import { sha256Hex } from '../../../security/src/hash.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderScreenResponse, ScreeningRequest } from '../compliance/ports.ts';
import { evaluateTransactionMonitoring, type MonitoringEvent } from '../compliance/monitoring.ts';

export const TM_RULE_REVIEW_STATES = [
  'DRAFT',
  'HUMAN_REVIEW_REQUIRED',
  'SANDBOX_ONLY',
  'PRODUCTION_POLICY_FORBIDDEN',
] as const;
export type TmRuleReviewState = (typeof TM_RULE_REVIEW_STATES)[number];

export type VersionedMonitoringRule = {
  readonly ruleId: string;
  readonly version: number;
  readonly configurationHash: string;
  readonly reviewState: TmRuleReviewState;
  readonly authoredBy: 'HUMAN' | 'AI';
  readonly humanReviewed: boolean;
  readonly productionPolicy: false;
};

export type CanonicalMonitoringFact = {
  readonly factId: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly providerRef: string | null;
  readonly outcome: 'CLEAR' | 'REVIEW' | 'HOLD' | 'UNAVAILABLE';
  readonly reasonCodes: readonly string[];
  readonly legalConclusion: false;
  readonly observedAt: UtcInstant;
};

export type TransactionMonitoringProviderPort = {
  evaluate(request: ScreeningRequest & { readonly journalId?: string }): ProviderScreenResponse;
};

export function freezeMonitoringRule(input: {
  readonly ruleId: string;
  readonly version: number;
  readonly configuration: string;
  readonly authoredBy: 'HUMAN' | 'AI';
  readonly humanReviewed: boolean;
}): VersionedMonitoringRule {
  const reviewState: TmRuleReviewState =
    input.authoredBy === 'AI' && !input.humanReviewed
      ? 'PRODUCTION_POLICY_FORBIDDEN'
      : input.humanReviewed
        ? 'SANDBOX_ONLY'
        : 'HUMAN_REVIEW_REQUIRED';
  return Object.freeze({
    ruleId: input.ruleId,
    version: input.version,
    configurationHash: sha256Hex(input.configuration),
    reviewState,
    authoredBy: input.authoredBy,
    humanReviewed: input.humanReviewed,
    productionPolicy: false,
  });
}

export function rejectUnreviewedAiThreshold(rule: VersionedMonitoringRule): boolean {
  return rule.authoredBy === 'AI' && !rule.humanReviewed;
}

export function canonicalFactsFromInternalRules(
  event: MonitoringEvent,
  recentCount: number,
  recentAmountMinor: bigint,
): readonly CanonicalMonitoringFact[] {
  return Object.freeze(
    evaluateTransactionMonitoring(event, recentCount, recentAmountMinor).map((alert) =>
      Object.freeze({
        factId: alert.alertId,
        ruleId: alert.ruleId,
        ruleVersion: 1,
        providerRef: null,
        outcome: alert.outcome,
        reasonCodes: alert.reasonCodes,
        legalConclusion: false,
        observedAt: alert.createdAt,
      }),
    ),
  );
}
