/**
 * External Data Trust Engine — deterministic multi-source trust assessment.
 *
 * No execution authority. No black-box AI. All outcomes explainable.
 */

import { randomUUID } from 'node:crypto';

import type { FreshnessStatus } from '../types.ts';
import { numericConsensus } from './consensus.ts';
import {
  checkSemanticEquivalence,
  checkTimeAlignment,
  checkUnitCompatibility,
  filterSemanticallyEquivalent,
  inferSemanticKey,
  inferUnit,
} from './equivalence.ts';
import {
  aggregateFreshness,
  bandMeetsMinimum,
  buildAuthoritySummary,
  computeObservationWeight,
  countIndependentSources,
  mapProviderRiskToHealth,
  roundConfidenceScore,
  scoreToConfidenceBand,
} from './factors.ts';
import { detectNumericOutliers, valuesDisagreeBeyondTolerance } from './outliers.ts';
import { getTrustPolicy } from './policies.ts';
import { trustReason, type TrustReason } from './reason-codes.ts';
import type {
  CanonicalTrustResult,
  ConfidenceBand,
  OutlierStatus,
  SelectionMethod,
  TrustEvidenceMetadata,
  TrustObservationContext,
  TrustPolicyProfile,
  TrustResultRecord,
  TrustResultStatus,
} from './types.ts';

export type TrustEngineOptions = {
  readonly nowUtc?: () => string;
};

export type AssessTrustInput<T = unknown> = {
  readonly contexts: readonly TrustObservationContext<T>[];
  readonly policyProfile: TrustPolicyProfile;
  readonly semanticKey: string;
  readonly unit?: string | null;
  readonly mapCanonicalValue?: (contexts: readonly TrustObservationContext<T>[], numericValue: number | null) => T | null;
};

export class ExternalDataTrustEngine {
  readonly #nowUtc: () => string;

  constructor(options: TrustEngineOptions = {}) {
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  assess<T>(input: AssessTrustInput<T>): CanonicalTrustResult<T> {
    const policy = getTrustPolicy(input.policyProfile);
    const generatedAt = this.#nowUtc();
    const inputIds = Object.freeze(input.contexts.map((c) => c.observation.observationId));
    const reasons: TrustReason[] = [];

    if (input.contexts.length === 0) {
      return this.#emptyResult<T>(input.policyProfile, policy.version, inputIds, generatedAt, [
        trustReason('NO_ELIGIBLE_OBSERVATIONS'),
        trustReason('INSUFFICIENT_SOURCES'),
      ]);
    }

  const semanticFilter = filterSemanticallyEquivalent(input.contexts, input.semanticKey);
    if (semanticFilter.excluded.length > 0) {
      reasons.push(
        trustReason(
          'SEMANTIC_MISMATCH',
          semanticFilter.excluded.map((c) => c.observation.observationId),
        ),
      );
    }

    const unitCheck = checkUnitCompatibility(semanticFilter.eligible, input.unit ?? null);
    if (!unitCheck.ok) {
      reasons.push(trustReason('UNIT_MISMATCH'));
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: 'UNAVAILABLE',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: [],
        excludedIds: Object.freeze([...semanticFilter.excluded, ...semanticFilter.eligible].map((c) => c.observation.observationId)),
        contexts: semanticFilter.eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness: 'unknown',
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }

    const timeCheck = checkTimeAlignment(semanticFilter.eligible, policy.maxTimeSkewMs);
    if (!timeCheck.ok) {
      reasons.push(trustReason('TIME_MISMATCH'));
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: 'CONFLICTED',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: Object.freeze(semanticFilter.eligible.map((c) => c.observation.observationId)),
        excludedIds: Object.freeze(semanticFilter.excluded.map((c) => c.observation.observationId)),
        contexts: semanticFilter.eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness: aggregateFreshness(semanticFilter.eligible),
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }

    const { eligible, excluded: riskExcluded, reasons: eligibilityReasons } = this.#filterEligible(
      semanticFilter.eligible,
      policy.authorityPrecedence,
    );
    reasons.push(...eligibilityReasons);

    const allExcluded = Object.freeze([
      ...semanticFilter.excluded.map((c) => c.observation.observationId),
      ...riskExcluded.map((c) => c.observation.observationId),
    ]);

    if (eligible.length === 0) {
      reasons.push(trustReason('NO_ELIGIBLE_OBSERVATIONS'));
      const onlyStale = semanticFilter.eligible.every(
        (c) => c.observation.quality.freshnessStatus === 'stale' || c.observation.quality.freshnessStatus === 'expired',
      );
      if (onlyStale) {
        reasons.push(trustReason('ALL_SOURCES_STALE'));
      }
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: onlyStale ? 'STALE' : 'INSUFFICIENT_DATA',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: [],
        excludedIds: allExcluded,
        contexts: semanticFilter.eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness: aggregateFreshness(semanticFilter.eligible),
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }

    const freshness = aggregateFreshness(eligible);
    const onlyStaleEligible =
      eligible.every((c) => c.observation.quality.freshnessStatus === 'stale') &&
      !eligible.some((c) => c.observation.quality.freshnessStatus === 'fresh' || c.observation.quality.freshnessStatus === 'aging');
    const onlyExpired =
      eligible.every((c) => c.observation.quality.freshnessStatus === 'expired');

    if (onlyExpired) {
      reasons.push(trustReason('SOURCE_EXPIRED'));
      reasons.push(trustReason('ALL_SOURCES_STALE'));
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: 'INSUFFICIENT_DATA',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: [],
        excludedIds: allExcluded,
        contexts: eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness,
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }

    if (onlyStaleEligible && !policy.allowStaleCanonical) {
      reasons.push(trustReason('ALL_SOURCES_STALE'));
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: 'STALE',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: [],
        excludedIds: allExcluded,
        contexts: eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness,
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }

    if (input.policyProfile === 'CHAIN_STATE') {
      return this.#assessChainState<T>(input, eligible as readonly TrustObservationContext<T>[], allExcluded, reasons, generatedAt);
    }

    if (input.policyProfile === 'COMPLIANCE_EVIDENCE') {
      return this.#assessComplianceEvidence<T>(input, eligible as readonly TrustObservationContext<T>[], allExcluded, reasons, generatedAt);
    }

    if (input.policyProfile === 'RESEARCH') {
      return this.#assessResearch<T>(input, eligible as readonly TrustObservationContext<T>[], allExcluded, reasons, generatedAt);
    }

    if (input.policyProfile === 'WEATHER' && policy.selectionMethod === 'RETAIN_ALL') {
      return this.#assessRetainAll<T>(input, eligible as readonly TrustObservationContext<T>[], allExcluded, reasons, generatedAt, freshness);
    }

    const outlierResults = policy.numericConsensus
      ? detectNumericOutliers(
          eligible
            .filter((c) => c.numericValue !== undefined && c.numericValue !== null)
            .map((c) => ({ observationId: c.observation.observationId, value: c.numericValue! })),
          policy.outlierTolerancePercent,
        )
      : [];

    const outlierIds = new Set(
      outlierResults.filter((o) => o.status === 'OUTLIER').map((o) => o.observationId),
    );
    for (const id of outlierIds) {
      reasons.push(trustReason('VALUE_OUTLIER', [id]));
    }
    const suspectedIds = outlierResults
      .filter((o) => o.status === 'SUSPECTED_OUTLIER')
      .map((o) => o.observationId);
    for (const id of suspectedIds) {
      if (!outlierIds.has(id)) {
        reasons.push(trustReason('VALUE_OUTLIER', [id]));
      }
    }

    const consensusEligible = eligible.filter((c) => !outlierIds.has(c.observation.observationId));
    const numericValues = consensusEligible
      .filter((c) => c.numericValue !== undefined && c.numericValue !== null)
      .map((c) => c.numericValue!);

    const hasConflict =
      policy.numericConsensus &&
      numericValues.length >= 2 &&
      valuesDisagreeBeyondTolerance(numericValues, policy.outlierTolerancePercent);

    if (hasConflict && consensusEligible.length >= 2) {
      const official = consensusEligible.find(
        (c) => c.observation.authority.authorityClass === 'authoritative_official',
      );
      const aggregators = consensusEligible.filter(
        (c) => c.observation.authority.authorityClass !== 'authoritative_official',
      );
      if (official && aggregators.length > 0) {
        const officialVal = official.numericValue!;
        const aggregatorConflict = aggregators.some(
          (a) =>
            Math.abs((a.numericValue! - officialVal) / Math.max(Math.abs(officialVal), 1e-9)) * 100 >
            policy.outlierTolerancePercent,
        );
        if (aggregatorConflict) {
          reasons.push(trustReason('AUTHORITY_OVERRIDE', [official.observation.observationId]));
          reasons.push(trustReason('OFFICIAL_SOURCE_SELECTED', [official.observation.observationId]));
          const canonicalValue = input.mapCanonicalValue
            ? input.mapCanonicalValue([official] as readonly TrustObservationContext<T>[], officialVal)
            : (official.observation.data as T);
          return this.#buildResult<T>({
            policyProfile: input.policyProfile,
            policyVersion: policy.version,
            status: 'TRUSTED',
            canonicalValue,
            unit: input.unit ?? inferUnit(official.observation) ?? null,
            inputIds,
            selectedIds: [official.observation.observationId],
            supportingIds: [official.observation.observationId],
            conflictingIds: aggregators.map((a) => a.observation.observationId),
            excludedIds: allExcluded,
            contexts: eligible,
            confidenceBand: 'HIGH',
            confidenceScore: 0.9,
            freshness,
            selectionMethod: 'AUTHORITY_PRECEDENCE',
            outlierStatus: 'NONE',
            reasons,
            generatedAt,
          });
        }
      }
      reasons.push(trustReason('PROVIDER_CONFLICT', consensusEligible.map((c) => c.observation.observationId)));
      return this.#buildResult<T>({
        policyProfile: input.policyProfile,
        policyVersion: policy.version,
        status: 'CONFLICTED',
        canonicalValue: null,
        unit: input.unit ?? null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: Object.freeze(consensusEligible.map((c) => c.observation.observationId)),
        excludedIds: allExcluded,
        contexts: eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness,
        selectionMethod: 'NO_SELECTION',
        outlierStatus: outlierResults.some((o) => o.status !== 'NONE') ? 'OUTLIER' : 'NONE',
        reasons,
        generatedAt,
      });
    }

    const selectionMethod: SelectionMethod =
      eligible.length === 1 ? 'SINGLE_AUTHORITATIVE_SOURCE' : policy.selectionMethod;

    let consensusResult = policy.numericConsensus
      ? numericConsensus({
          contexts: consensusEligible,
          method: selectionMethod,
          authorityPrecedence: policy.authorityPrecedence,
        })
      : {
          value: null,
          selectedObservationIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
          supportingObservationIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
          method: 'RETAIN_ALL' as SelectionMethod,
        };

    if (eligible.length === 1) {
      reasons.push(trustReason('SINGLE_AUTHORITATIVE_SOURCE', [eligible[0]!.observation.observationId]));
    } else if (consensusResult.supportingObservationIds.length > 1) {
      reasons.push(trustReason('MULTI_SOURCE_CORROBORATION', consensusResult.supportingObservationIds));
    }

    const corroborationCount = countIndependentSources(
      eligible.filter((c) => consensusResult.supportingObservationIds.includes(c.observation.observationId)),
    );
    if (corroborationCount < eligible.length) {
      reasons.push(trustReason('MIRRORED_SOURCE_DEDUPED'));
    }

    const avgWeight =
      eligible.reduce((sum, c) => sum + computeObservationWeight(c, policy.authorityPrecedence), 0) / eligible.length;
    const corroborationBonus = Math.min(0.15, (corroborationCount - 1) * 0.05);
    const confidenceScore = roundConfidenceScore(Math.min(1, avgWeight + corroborationBonus));
    const confidenceBand = scoreToConfidenceBand(confidenceScore);

    if (corroborationCount < policy.minCorroboration) {
      reasons.push(trustReason('INSUFFICIENT_SOURCES'));
    }

    if (!bandMeetsMinimum(confidenceBand, policy.minConfidenceBand)) {
      reasons.push(trustReason('CONFIDENCE_BELOW_THRESHOLD'));
    }

    let status: TrustResultStatus;
    if (onlyStaleEligible) {
      status = 'STALE';
      reasons.push(trustReason('ALL_SOURCES_STALE'));
    } else if (corroborationCount < policy.minCorroboration) {
      status = 'INSUFFICIENT_DATA';
    } else if (!bandMeetsMinimum(confidenceBand, policy.minConfidenceBand)) {
      status = 'LOW_CONFIDENCE';
    } else if (confidenceBand === 'HIGH' && corroborationCount >= 2) {
      status = 'TRUSTED';
    } else {
      status = 'SUPPORTED';
    }

    const canonicalValue = input.mapCanonicalValue
      ? input.mapCanonicalValue(eligible as readonly TrustObservationContext<T>[], consensusResult.value)
      : consensusResult.value !== null
        ? (eligible.find((c) => c.observation.observationId === consensusResult.selectedObservationIds[0])?.observation.data as T)
        : null;

    if (status !== 'INSUFFICIENT_DATA' && status !== 'LOW_CONFIDENCE' && canonicalValue === null && policy.numericConsensus) {
      status = 'UNAVAILABLE';
    }

    const overallOutlier: OutlierStatus = outlierResults.some((o) => o.status === 'OUTLIER')
      ? 'OUTLIER'
      : outlierResults.some((o) => o.status === 'SUSPECTED_OUTLIER')
        ? 'SUSPECTED_OUTLIER'
        : 'NONE';

    return this.#buildResult<T>({
      policyProfile: input.policyProfile,
      policyVersion: policy.version,
      status,
      canonicalValue,
      unit: input.unit ?? inferUnit(eligible[0]!.observation) ?? null,
      inputIds,
      selectedIds: consensusResult.selectedObservationIds,
      supportingIds: consensusResult.supportingObservationIds,
      conflictingIds: [],
      excludedIds: allExcluded,
      contexts: eligible,
      confidenceBand,
      confidenceScore,
      freshness,
      selectionMethod,
      outlierStatus: overallOutlier,
      reasons,
      generatedAt,
    });
  }

  toEvidenceMetadata(result: CanonicalTrustResult<unknown>): TrustEvidenceMetadata {
    return Object.freeze({
      sourceCount: result.inputObservationIds.length,
      corroborationCount: result.corroborationCount,
      confidenceBand: result.confidenceBand,
      confidenceScore: result.confidenceScore,
      freshness: result.freshness,
      status: result.status,
      hasConflicts: result.conflictingObservationIds.length > 0 || result.status === 'CONFLICTED',
      authorityDominant: result.authoritySummary.dominantClass,
      trustPolicyVersion: result.trustPolicyVersion,
      grantsExecutionAuthority: false,
    });
  }

  toAuditRecord(result: CanonicalTrustResult<unknown>): TrustResultRecord {
    return Object.freeze({
      recordId: randomUUID(),
      trustPolicyVersion: result.trustPolicyVersion,
      trustPolicyProfile: result.trustPolicyProfile,
      inputObservationIds: result.inputObservationIds,
      selectedObservationIds: result.selectedObservationIds,
      excludedObservationIds: result.excludedObservationIds,
      reasonCodes: Object.freeze(result.reasons.map((r) => r.code)),
      status: result.status,
      confidenceBand: result.confidenceBand,
      generatedAt: result.generatedAt,
    });
  }

  #filterEligible(
    contexts: readonly TrustObservationContext[],
    authorityPrecedence: readonly import('../types.ts').AuthorityClass[],
  ): {
    readonly eligible: readonly TrustObservationContext[];
    readonly excluded: readonly TrustObservationContext[];
    readonly reasons: readonly TrustReason[];
  } {
    const eligible: TrustObservationContext[] = [];
    const excluded: TrustObservationContext[] = [];
    const reasons: TrustReason[] = [];

    for (const ctx of contexts) {
      const health = mapProviderRiskToHealth(ctx.providerRiskState, ctx.quarantined);
      if (health === 'quarantined') {
        excluded.push(ctx);
        reasons.push(trustReason('SOURCE_QUARANTINED', [ctx.observation.observationId]));
        continue;
      }
      if (ctx.observation.quality.freshnessStatus === 'expired') {
        excluded.push(ctx);
        reasons.push(trustReason('SOURCE_EXPIRED', [ctx.observation.observationId]));
        continue;
      }
      if (ctx.observation.quality.validationStatus !== 'valid') {
        excluded.push(ctx);
        reasons.push(trustReason('SOURCE_UNHEALTHY', [ctx.observation.observationId]));
        continue;
      }
      if (health === 'degraded') {
        reasons.push(trustReason('SOURCE_DEGRADED', [ctx.observation.observationId]));
      }
      if (ctx.observation.quality.freshnessStatus === 'stale') {
        reasons.push(trustReason('SOURCE_STALE', [ctx.observation.observationId]));
      }
      if (ctx.observation.quality.freshnessStatus === 'aging') {
        reasons.push(trustReason('SOURCE_AGING', [ctx.observation.observationId]));
      }
      eligible.push(ctx);
    }

    return Object.freeze({ eligible: Object.freeze(eligible), excluded: Object.freeze(excluded), reasons: Object.freeze(reasons) });
  }

  #assessChainState<T>(
    input: AssessTrustInput<T>,
    eligible: readonly TrustObservationContext<T>[],
    excludedIds: readonly string[],
    reasons: TrustReason[],
    generatedAt: string,
  ): CanonicalTrustResult<T> {
    const policy = getTrustPolicy('CHAIN_STATE');
    const inputIds = Object.freeze(input.contexts.map((c) => c.observation.observationId));
    const hashes = eligible.map((c) => {
      const data = c.observation.data as Record<string, unknown>;
      return typeof data.blockHash === 'string' ? data.blockHash : null;
    });
    const uniqueHashes = new Set(hashes.filter(Boolean));
    if (uniqueHashes.size > 1) {
      reasons.push(trustReason('CHAIN_STATE_CONFLICT', eligible.map((c) => c.observation.observationId)));
      reasons.push(trustReason('PROVIDER_CONFLICT', eligible.map((c) => c.observation.observationId)));
      return this.#buildResult<T>({
        policyProfile: 'CHAIN_STATE',
        policyVersion: policy.version,
        status: 'CONFLICTED',
        canonicalValue: null,
        unit: null,
        inputIds,
        selectedIds: [],
        supportingIds: [],
        conflictingIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
        excludedIds,
        contexts: eligible,
        confidenceBand: 'LOW',
        confidenceScore: null,
        freshness: aggregateFreshness(eligible),
        selectionMethod: 'NO_SELECTION',
        outlierStatus: 'NONE',
        reasons,
        generatedAt,
      });
    }
    const selected = eligible[0];
    return this.#buildResult<T>({
      policyProfile: 'CHAIN_STATE',
      policyVersion: policy.version,
      status: eligible.length >= 2 ? 'TRUSTED' : 'SUPPORTED',
      canonicalValue: selected ? (selected.observation.data as T) : null,
      unit: null,
      inputIds,
      selectedIds: selected ? [selected.observation.observationId] : [],
      supportingIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      conflictingIds: [],
      excludedIds,
      contexts: eligible,
      confidenceBand: eligible.length >= 2 ? 'HIGH' : 'MEDIUM',
      confidenceScore: eligible.length >= 2 ? 0.85 : 0.6,
      freshness: aggregateFreshness(eligible),
      selectionMethod: 'NO_SELECTION',
      outlierStatus: 'NONE',
      reasons,
      generatedAt,
    });
  }

  #assessComplianceEvidence<T>(
    input: AssessTrustInput<T>,
    eligible: readonly TrustObservationContext<T>[],
    excludedIds: readonly string[],
    reasons: TrustReason[],
    generatedAt: string,
  ): CanonicalTrustResult<T> {
    const policy = getTrustPolicy('COMPLIANCE_EVIDENCE');
    reasons.push(trustReason('COMPLIANCE_EVIDENCE_INDEPENDENT'));
    const inputIds = Object.freeze(input.contexts.map((c) => c.observation.observationId));
    return this.#buildResult<T>({
      policyProfile: 'COMPLIANCE_EVIDENCE',
      policyVersion: policy.version,
      status: 'SUPPORTED',
      canonicalValue: null,
      unit: null,
      inputIds,
      selectedIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      supportingIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      conflictingIds: [],
      excludedIds,
      contexts: eligible,
      confidenceBand: 'MEDIUM',
      confidenceScore: 0.6,
      freshness: aggregateFreshness(eligible),
      selectionMethod: 'RETAIN_ALL',
      outlierStatus: 'NONE',
      reasons,
      generatedAt,
    });
  }

  #assessResearch<T>(
    input: AssessTrustInput<T>,
    eligible: readonly TrustObservationContext<T>[],
    excludedIds: readonly string[],
    reasons: TrustReason[],
    generatedAt: string,
  ): CanonicalTrustResult<T> {
    const policy = getTrustPolicy('RESEARCH');
    reasons.push(trustReason('RESEARCH_QUALITY_METADATA_ONLY'));
    const inputIds = Object.freeze(input.contexts.map((c) => c.observation.observationId));
    return this.#buildResult<T>({
      policyProfile: 'RESEARCH',
      policyVersion: policy.version,
      status: 'SUPPORTED',
      canonicalValue: null,
      unit: null,
      inputIds,
      selectedIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      supportingIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      conflictingIds: [],
      excludedIds,
      contexts: eligible,
      confidenceBand: 'MEDIUM',
      confidenceScore: 0.55,
      freshness: aggregateFreshness(eligible),
      selectionMethod: 'RETAIN_ALL',
      outlierStatus: 'NONE',
      reasons,
      generatedAt,
    });
  }

  #assessRetainAll<T>(
    input: AssessTrustInput<T>,
    eligible: readonly TrustObservationContext<T>[],
    excludedIds: readonly string[],
    reasons: TrustReason[],
    generatedAt: string,
    freshness: FreshnessStatus,
  ): CanonicalTrustResult<T> {
    const policy = getTrustPolicy(input.policyProfile);
    reasons.push(trustReason('FORECAST_NOT_CONSOLIDATED'));
    const inputIds = Object.freeze(input.contexts.map((c) => c.observation.observationId));
    const corroborationCount = countIndependentSources(eligible);
    if (corroborationCount >= 2) {
      reasons.push(trustReason('MULTI_SOURCE_CORROBORATION', eligible.map((c) => c.observation.observationId)));
    }
    return this.#buildResult<T>({
      policyProfile: input.policyProfile,
      policyVersion: policy.version,
      status: corroborationCount >= 2 ? 'SUPPORTED' : 'LOW_CONFIDENCE',
      canonicalValue: null,
      unit: input.unit ?? null,
      inputIds,
      selectedIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      supportingIds: Object.freeze(eligible.map((c) => c.observation.observationId)),
      conflictingIds: [],
      excludedIds,
      contexts: eligible,
      confidenceBand: corroborationCount >= 2 ? 'MEDIUM' : 'LOW',
      confidenceScore: corroborationCount >= 2 ? 0.55 : 0.35,
      freshness,
      selectionMethod: 'RETAIN_ALL',
      outlierStatus: 'NONE',
      reasons,
      generatedAt,
    });
  }

  #emptyResult<T = unknown>(
    profile: TrustPolicyProfile,
    version: string,
    inputIds: readonly string[],
    generatedAt: string,
    reasons: readonly TrustReason[],
  ): CanonicalTrustResult<T> {
    return Object.freeze({
      canonicalValue: null,
      canonicalUnit: null,
      status: 'UNAVAILABLE',
      confidenceScore: null,
      confidenceBand: 'LOW',
      freshness: 'unknown',
      inputObservationIds: inputIds,
      selectedObservationIds: Object.freeze([]),
      supportingObservationIds: Object.freeze([]),
      conflictingObservationIds: Object.freeze([]),
      excludedObservationIds: Object.freeze([]),
      authoritySummary: Object.freeze({ dominantClass: null, classesPresent: Object.freeze([]), officialSourceCount: 0 }),
      providerDiversity: 0,
      corroborationCount: 0,
      outlierStatus: 'NONE',
      selectionMethod: 'NO_SELECTION',
      trustPolicyVersion: version,
      trustPolicyProfile: profile,
      reasons,
      generatedAt,
      grantsExecutionAuthority: false,
    });
  }

  #buildResult<T>(params: {
    readonly policyProfile: TrustPolicyProfile;
    readonly policyVersion: string;
    readonly status: TrustResultStatus;
    readonly canonicalValue: T | null;
    readonly unit: string | null;
    readonly inputIds: readonly string[];
    readonly selectedIds: readonly string[];
    readonly supportingIds: readonly string[];
    readonly conflictingIds: readonly string[];
    readonly excludedIds: readonly string[];
    readonly contexts: readonly TrustObservationContext[];
    readonly confidenceBand: ConfidenceBand;
    readonly confidenceScore: number | null;
    readonly freshness: FreshnessStatus;
    readonly selectionMethod: SelectionMethod;
    readonly outlierStatus: OutlierStatus;
    readonly reasons: readonly TrustReason[];
    readonly generatedAt: string;
  }): CanonicalTrustResult<T> {
    const authoritySummary = buildAuthoritySummary(params.contexts);
    const corroborationCount = countIndependentSources(
      params.contexts.filter((c) => params.supportingIds.includes(c.observation.observationId)),
    );
    return Object.freeze({
      canonicalValue: params.canonicalValue,
      canonicalUnit: params.unit,
      status: params.status,
      confidenceScore: params.confidenceScore,
      confidenceBand: params.confidenceBand,
      freshness: params.freshness,
      inputObservationIds: params.inputIds,
      selectedObservationIds: params.selectedIds,
      supportingObservationIds: params.supportingIds,
      conflictingObservationIds: params.conflictingIds,
      excludedObservationIds: params.excludedIds,
      authoritySummary,
      providerDiversity: countIndependentSources(params.contexts),
      corroborationCount,
      outlierStatus: params.outlierStatus,
      selectionMethod: params.selectionMethod,
      trustPolicyVersion: params.policyVersion,
      trustPolicyProfile: params.policyProfile,
      reasons: params.reasons,
      generatedAt: params.generatedAt,
      grantsExecutionAuthority: false,
    });
  }
}

export function createExternalDataTrustEngine(options?: TrustEngineOptions): ExternalDataTrustEngine {
  return new ExternalDataTrustEngine(options);
}
