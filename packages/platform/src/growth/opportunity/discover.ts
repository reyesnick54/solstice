import { asUtcInstant } from '../../../../domain/src/time.ts';
import { opportunityIdFor } from '../../ids.ts';
import { DETECTOR_TO_CATEGORY, DETECTOR_TO_CARD } from './taxonomy.ts';
import { runOpportunityDetectors } from './detectors.ts';
import { applyDiversity, fingerprintOf, shouldSuppress } from './diversity.ts';
import { evaluateOpportunityEligibility } from './eligibility.ts';
import { explanationInputFor } from './explain.ts';
import { goalLinksFor } from './goals.ts';
import { impactFromFinding } from './impact.ts';
import { transitionOpportunity } from './lifecycle.ts';
import { preferenceSuppresses } from './preferences.ts';
import { assignPriorities, rankOpportunity } from './ranking.ts';
import type { Opportunity, OpportunityDiscoveryInput } from './types.ts';
import type { DetectorFinding } from './types.ts';
import { isCandidateEligibleForRanking } from '../../../../ai-runtime/src/market-research.ts';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function expiresAt(now: string): Opportunity['expiresAt'] {
  return asUtcInstant(new Date(Date.parse(now) + TTL_MS).toISOString());
}

export function discoverOpportunities(input: OpportunityDiscoveryInput): {
  readonly all: readonly Opportunity[];
  readonly presented: readonly Opportunity[];
  readonly suppressedCount: number;
} {
  const findings = [
    ...runOpportunityDetectors(input),
    ...(input.marketResearch ? researchFindings(input.marketResearch, input.context.now) : []),
  ];
  const built: Opportunity[] = [];
  for (const finding of findings) {
    const category = DETECTOR_TO_CATEGORY[finding.detector];
    const fingerprint = fingerprintOf(finding.detector, category, finding.currency, finding.fingerprintAnchor);
    const suppression = shouldSuppress({
      fingerprint,
      previous: input.context.previous,
      ...(finding.estimatedImpact ? { nextEstimatedMinor: finding.estimatedImpact.minorUnits } : {}),
    });
    const eligibility = evaluateOpportunityEligibility({
      finding,
      context: input.context,
      ...(input.mandate ? { mandate: input.mandate } : {}),
    });
    const preferenceBlocked = preferenceSuppresses(input.context.preferences, category);
    const eligible = eligibility.eligible && !preferenceBlocked;
    const prior = input.context.previous.find((item) => item.fingerprint === fingerprint);
    let status: Opportunity['status'] = eligible ? 'ELIGIBLE' : 'INELIGIBLE';
    if (suppression.suppress && prior) {
      status = prior.status === 'DISMISSED' || prior.status === 'COMPLETED' || prior.status === 'SUPERSEDED' || prior.status === 'EXPIRED'
        ? prior.status
        : status;
    }
    const goalLinks = goalLinksFor(finding, input.snapshot, input.context, input.mandate);
    const impact = impactFromFinding(finding, input.context.now);
    const reuseId =
      prior &&
      suppression.suppress &&
      (prior.status === 'DISMISSED' || prior.status === 'COMPLETED' || prior.status === 'SUPERSEDED');
    const draft = {
      opportunityId: reuseId
        ? prior.opportunityId
        : opportunityIdFor(finding.detector, `${input.subjectId}_${finding.fingerprintAnchor}`.replace(/[^a-zA-Z0-9_]/g, '_')),
      subjectId: input.subjectId,
      type: category,
      detector: finding.detector,
      title: finding.title,
      summary: finding.summary,
      source: finding.source,
      eligible,
      priority: 0,
      ...(finding.estimatedImpact ? { estimatedImpact: finding.estimatedImpact } : {}),
      ...(finding.impactRange ? { impactRange: finding.impactRange } : {}),
      riskLevel: finding.riskLevel,
      liquidityImpact: finding.liquidityImpact,
      timeHorizon: finding.timeHorizon,
      fees: finding.fees,
      dependencies: finding.dependencies,
      goalLinks,
      evidence: finding.evidence,
      expiresAt: expiresAt(input.context.now),
      status,
      fingerprint,
      impact,
      eligibility: preferenceBlocked
        ? {
            ...eligibility,
            eligible: false,
            reasons: Object.freeze([...eligibility.reasons, 'category_excluded_by_preference']),
            failedChecks: eligibility.failedChecks,
          }
        : eligibility,
      ranking: rankOpportunity(
        {
          opportunityId: opportunityIdFor(finding.detector, 'rank'),
          subjectId: input.subjectId,
          type: category,
          detector: finding.detector,
          title: finding.title,
          summary: finding.summary,
          source: finding.source,
          eligible,
          fees: finding.fees,
          goalLinks,
          impact,
          liquidityImpact: finding.liquidityImpact,
          riskLevel: finding.riskLevel,
          estimatedImpact: finding.estimatedImpact,
          impactRange: finding.impactRange,
        } as Parameters<typeof rankOpportunity>[0],
        input.context.preferences,
        finding.confidence,
        finding.urgency,
      ),
      card: DETECTOR_TO_CARD[finding.detector],
      ...(finding.productId ? { productId: finding.productId } : {}),
      currency: finding.currency,
      createdAt: prior?.createdAt ?? input.context.now,
      updatedAt: input.context.now,
      ...(prior && suppression.suppress && prior.status === 'DISMISSED' ? { dismissalReason: prior.dismissalReason } : {}),
    } satisfies Opportunity;
    if (Date.parse(draft.expiresAt) <= Date.parse(input.context.now) && draft.status !== 'EXPIRED') {
      const expired = transitionOpportunity(draft.status, 'EXPIRED');
      if (expired.ok) {
        built.push({ ...draft, status: expired.value });
        continue;
      }
    }
    built.push(draft);
  }
  const ranked = assignPriorities(built);
  const diversity = applyDiversity(
    ranked.filter((item) => item.status === 'ELIGIBLE' || item.status === 'PRESENTED' || item.status === 'DETECTED'),
  );
  const presentedIds = new Set(diversity.presented.map((item) => item.opportunityId));
  const merged = ranked.map((item) => {
    const presented = diversity.presented.find((row) => row.opportunityId === item.opportunityId);
    return presented ?? item;
  });
  return {
    all: Object.freeze(merged),
    presented: Object.freeze(merged.filter((item) => presentedIds.has(item.opportunityId) && item.status === 'PRESENTED')),
    suppressedCount: diversity.suppressed.length + ranked.filter((item) => item.status !== 'ELIGIBLE' && item.status !== 'PRESENTED' && item.status !== 'DETECTED').length,
  };
}

function researchFindings(research: NonNullable<OpportunityDiscoveryInput['marketResearch']>, now: string): readonly DetectorFinding[] {
  return Object.freeze(research.candidates.filter((candidate) => isCandidateEligibleForRanking(candidate, now)).map((candidate) => ({
    detector: 'MARKET_RESEARCH_CANDIDATE',
    title: `${candidate.symbol}: public market research`,
    summary: candidate.thesis,
    source: 'PUBLIC_MARKET_RESEARCH',
    currency: candidate.currency,
    riskLevel: candidate.riskScoreBps >= 7_500 ? 'HIGH' : candidate.riskScoreBps >= 5_000 ? 'UNCERTAIN_MARKET' : 'MODERATE',
    liquidityImpact: 'UNKNOWN',
    timeHorizon: candidate.timeHorizon === 'SHORT_TERM' ? 'NEAR_TERM' : candidate.timeHorizon === 'LONG_TERM' ? 'LONG_TERM' : 'MEDIUM_TERM',
    fees: Object.freeze([]),
    dependencies: Object.freeze(['public_research_is_not_customer_advice']),
    goalIds: Object.freeze([]),
    evidence: Object.freeze({
      factRefs: Object.freeze(candidate.sourceRefs),
      detector: 'MARKET_RESEARCH_CANDIDATE',
      notes: Object.freeze(candidate.evidence),
    }),
    productId: 'prod_paper_investment_review',
    confidence: candidate.confidenceBps,
    urgency: candidate.catalystScoreBps,
    assumptions: Object.freeze([
      `scenarios are forecasts only: downside=${candidate.downsideScenarioBps}bps, base=${candidate.baseScenarioBps}bps, upside=${candidate.upsideScenarioBps}bps`,
      'customer suitability and private financial checks occur inside SunRey',
    ]),
    impactKind: 'SCENARIO_RANGE',
    fingerprintAnchor: candidate.candidateId,
  } satisfies DetectorFinding)));
}

export function explanationForOpportunity(opportunity: Opportunity): ReturnType<typeof explanationInputFor> {
  return explanationInputFor(opportunity);
}
