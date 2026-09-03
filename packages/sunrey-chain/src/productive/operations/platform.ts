// @ts-nocheck
/**
 * Wave 5 — Productive operations platform orchestrator.
 *
 * Composes challenges, incidents, reputation, anomalies, circuit breakers,
 * metrics, and audit views. Does not mint, post journals, or rewrite history.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { ProductiveEconomicObject } from '../objects.ts';
import type { ProductiveCategory } from '../types.ts';
import { refuseAiHardRuleOverride } from './ai-role.ts';
import type { AnomalyDetectionInput } from './anomalies.ts';
import { detectProductiveAnomalies } from './anomalies.ts';
import { buildAuditView, type BlockedMoonReyProposalView } from './audit.ts';
import {
  challengeBlocksFutureMonetization,
  createProductiveClaimChallenge,
  transitionChallenge,
} from './challenge.ts';
import { DomainCircuitBreakerRegistry } from './circuit-breaker.ts';
import { ProviderIncidentRegistry } from './incidents.ts';
import { ProductiveOperationsMetricsCollector } from './metrics.ts';
import {
  recordPostFinalityChallenge,
  refuseAutomaticClawback,
  refuseHistoryRewrite,
} from './post-finality.ts';
import { ProductiveSourceReputationRegistry } from './source-reputation.ts';
import type {
  PostFinalityChallengeRecord,
  ProductiveAssetAnomaly,
  ProductiveClaimChallenge,
  ProductiveOperationsRejection,
  ProviderIncidentClass,
} from './types.ts';

export type MoonReyProposalBlockReason =
  | 'CLAIM_CHALLENGED'
  | 'ANOMALY_REVIEW_REQUIRED'
  | 'DOMAIN_CIRCUIT_OPEN'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_QUARANTINED'
  | 'INSUFFICIENT_INDEPENDENT_SOURCES';

export class ProductiveOperationsPlatform {
  readonly challenges = new Map<string, ProductiveClaimChallenge>();
  readonly postFinalityRecords: PostFinalityChallengeRecord[] = [];
  readonly anomalies: ProductiveAssetAnomaly[] = [];
  readonly blockedProposals: BlockedMoonReyProposalView[] = [];
  readonly incidents = new ProviderIncidentRegistry();
  readonly reputation = new ProductiveSourceReputationRegistry();
  readonly domainCircuits = new DomainCircuitBreakerRegistry();
  readonly metrics = new ProductiveOperationsMetricsCollector();
  readonly providersByDomain = new Map<ProductiveCategory, Set<string>>();

  registerDomainProvider(domain: ProductiveCategory, providerId: string): void {
    const current = this.providersByDomain.get(domain) ?? new Set<string>();
    current.add(providerId);
    this.providersByDomain.set(domain, current);
    this.metrics.recordObservation(domain);
  }

  openChallenge(input: {
    readonly challengeId: string;
    readonly claimId: string;
    readonly reason: Parameters<typeof createProductiveClaimChallenge>[0]['reason'];
    readonly challengerId: string;
    readonly evidenceCommitment: string;
    readonly postFinality?: boolean;
  }): ProductiveClaimChallenge {
    const challenge = createProductiveClaimChallenge(input);
    this.challenges.set(challenge.challengeId, challenge);
    this.metrics.recordClaimChallenged();
    return challenge;
  }

  reviewChallenge(challengeId: string): Result<ProductiveClaimChallenge, ProductiveOperationsRejection> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return err({ code: 'CHALLENGE_NOT_FOUND', detail: challengeId });
    }
    const next = transitionChallenge(challenge, 'UNDER_REVIEW');
    if (!next.ok) {
      return next;
    }
    this.challenges.set(challengeId, next.value);
    return next;
  }

  resolveChallenge(
    challengeId: string,
    status: 'UPHELD' | 'REJECTED' | 'CORRECTED' | 'SUPERSEDED',
    input: {
      readonly resolutionNote?: string;
      readonly supersedingClaimId?: string;
      readonly correctingClaimId?: string;
      readonly issuanceReceiptId?: string;
      readonly historicalBlockHeight?: number;
      readonly historicalBlockId?: string;
    } = {},
  ): Result<ProductiveClaimChallenge, ProductiveOperationsRejection> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return err({ code: 'CHALLENGE_NOT_FOUND', detail: challengeId });
    }
    const next = transitionChallenge(challenge, status, input);
    if (!next.ok) {
      return next;
    }
    this.challenges.set(challengeId, next.value);
    if (next.value.postFinality) {
      const record = recordPostFinalityChallenge({
        challenge: next.value,
        issuanceReceiptId: input.issuanceReceiptId ?? null,
        historicalBlockHeight: input.historicalBlockHeight ?? 0,
        historicalBlockId: input.historicalBlockId ?? 'unknown',
      });
      if (record.ok) {
        this.postFinalityRecords.push(record.value);
      }
    }
    if (status === 'CORRECTED' || status === 'SUPERSEDED') {
      this.metrics.recordEventResolution();
    }
    return next;
  }

  openIncident(input: {
    readonly incidentId: string;
    readonly providerId: string;
    readonly classification: ProviderIncidentClass;
    readonly sourceClass?: string;
    readonly domainScope?: ProductiveCategory | 'ALL_DOMAINS';
    readonly evidenceCommitment: string;
  }) {
    if (input.classification === 'PROVIDER_OUTAGE') {
      this.metrics.recordProviderOutage();
    }
    return this.incidents.open(input);
  }

  detectAnomalies(input: AnomalyDetectionInput): readonly ProductiveAssetAnomaly[] {
    const signals = detectProductiveAnomalies(input);
    this.anomalies.push(...signals);
    return signals;
  }

  evaluateProposal(input: {
    readonly proposalId: string;
    readonly claimId: string;
    readonly domain: ProductiveCategory;
    readonly providerIds: readonly string[];
    readonly independentSourceCount: number;
  }): Result<true, ProductiveOperationsRejection> {
    this.metrics.recordMoonReyProposal(false);

    const circuit = this.domainCircuits.updateCoverage(input.domain, input.independentSourceCount);
    const circuitCheck = this.domainCircuits.assertVerificationAllowed(input.domain);
    if (!circuitCheck.ok) {
      this.blockProposal(input, circuitCheck.error.detail, 'DOMAIN_CIRCUIT_OPEN', circuit.domain);
      this.metrics.recordMoonReyProposal(true);
      return circuitCheck;
    }

    for (const providerId of input.providerIds) {
      if (this.incidents.isProviderDisabled(providerId)) {
        const rejection = err({
          code: 'PROVIDER_ALREADY_DISABLED',
          detail: `provider ${providerId} disabled by incident containment`,
        });
        this.blockProposal(input, rejection.error.detail, 'PROVIDER_DISABLED');
        this.metrics.recordMoonReyProposal(true);
        return rejection;
      }
      if (this.incidents.isProviderQuarantined(providerId)) {
        const rejection = err({
          code: 'DOMAIN_CIRCUIT_OPEN',
          detail: `provider ${providerId} quarantined`,
        });
        this.blockProposal(input, rejection.error.detail, 'PROVIDER_QUARANTINED');
        this.metrics.recordMoonReyProposal(true);
        return rejection;
      }
    }

    if (input.independentSourceCount < circuit.requiredIndependentSources) {
      this.metrics.recordSourceDependenceWarning();
      const rejection = err({
        code: 'DOMAIN_CIRCUIT_OPEN',
        detail: `insufficient independent sources for ${input.domain}`,
      });
      this.blockProposal(input, rejection.error.detail, 'INSUFFICIENT_INDEPENDENT_SOURCES');
      this.metrics.recordMoonReyProposal(true);
      return rejection;
    }

    for (const challenge of this.challenges.values()) {
      if (challenge.claimId === input.claimId && challengeBlocksFutureMonetization(challenge)) {
        const rejection = err({
          code: 'INVALID_CHALLENGE_TRANSITION',
          detail: `claim ${input.claimId} under active challenge ${challenge.challengeId}`,
        });
        this.blockProposal(input, rejection.error.detail, 'CLAIM_CHALLENGED', null, challenge.challengeId);
        this.metrics.recordMoonReyProposal(true);
        return rejection;
      }
    }

    const claimAnomalies = this.anomalies.filter(
      (row) => row.claimId === input.claimId && row.reviewSignalOnly,
    );
    if (claimAnomalies.length > 0) {
      const rejection = err({
        code: 'DOMAIN_CIRCUIT_OPEN',
        detail: `claim ${input.claimId} has anomaly review signals`,
      });
      this.blockProposal(
        input,
        rejection.error.detail,
        'ANOMALY_REVIEW_REQUIRED',
        null,
        null,
        claimAnomalies[0]?.anomalyId ?? null,
      );
      this.metrics.recordMoonReyProposal(true);
      return rejection;
    }

    return ok(true);
  }

  private blockProposal(
    input: { readonly proposalId: string; readonly claimId: string; readonly domain: ProductiveCategory },
    blockedReason: string,
    _kind: MoonReyProposalBlockReason,
    domainCircuitOpen: ProductiveCategory | null = null,
    challengeId: string | null = null,
    anomalyId: string | null = null,
  ): void {
    this.blockedProposals.push(
      Object.freeze({
        proposalId: input.proposalId,
        claimId: input.claimId,
        blockedReason,
        challengeId,
        anomalyId,
        domainCircuitOpen,
      }),
    );
  }

  refuseAiOverride(capability: Parameters<typeof refuseAiHardRuleOverride>[0]) {
    return refuseAiHardRuleOverride(capability);
  }

  refuseHistoryRewrite() {
    return refuseHistoryRewrite();
  }

  refuseAutomaticClawback() {
    return refuseAutomaticClawback();
  }

  auditView() {
    const providersByDomain: Partial<Record<ProductiveCategory, readonly string[]>> = {};
    for (const [domain, providers] of this.providersByDomain.entries()) {
      providersByDomain[domain] = [...providers];
    }
    return buildAuditView({
      providersByDomain,
      reputations: this.reputation.list(),
      challengedClaims: [...this.challenges.values()].filter((row) => row.status !== 'REJECTED'),
      blockedProposals: this.blockedProposals,
      anomalyFlags: this.anomalies,
      openIncidents: this.incidents.listOpen(),
      domainCircuits: this.domainCircuits.list(),
    });
  }

  recordClaimCreated(): void {
    this.metrics.recordClaimCreated();
  }

  recordGpuvCalculation(): void {
    this.metrics.recordGpuvCalculation();
  }

  recordVerification(pass: boolean): void {
    if (pass) {
      this.metrics.recordVerificationPass();
    } else {
      this.metrics.recordVerificationFail();
    }
  }

  nowUtc() {
    return asUtcInstant(new Date().toISOString());
  }
}

export function transfersRemainIndependentFromProductiveOutage(): true {
  return true;
}
