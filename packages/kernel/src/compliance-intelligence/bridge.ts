// @ts-nocheck
/**
 * Bridge external compliance evidence to Kernel compliance fabric.
 * Evidence is input; Compliance Kernel remains decision authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { escalateFromComplianceFacts, type ComplianceFacts, type Escalation } from '../compliance/facts.ts';
import type { ProviderScreenResponse, ScreeningRequest } from '../compliance/ports.ts';
import type { ScreeningOutcome } from '../compliance/types.ts';
import { screeningResponseToFact, type ScreeningEvidenceFact } from '../regulated/screening.ts';
import type { ComplianceScreeningEvidenceService } from './service.ts';
import { complianceSeparationProof } from './separation.ts';
import type { ComplianceEvidence, ComplianceEvidenceClassification } from './types.ts';

export type EvidenceKernelBridgeResult = {
  readonly evidenceFacts: readonly ScreeningEvidenceFact[];
  readonly evidenceRefs: readonly string[];
  readonly providerHints: readonly ProviderScreenResponse[];
  readonly kernelDecides: true;
  readonly separationProof: ReturnType<typeof complianceSeparationProof>;
};

function classificationToScreeningType(
  classification: ComplianceEvidenceClassification,
): 'SANCTIONS' | 'PEP' | 'ADVERSE_MEDIA' {
  if (classification === 'PEP') return 'PEP';
  if (classification === 'WANTED' || classification === 'ENFORCEMENT') return 'ADVERSE_MEDIA';
  return 'SANCTIONS';
}

function evidenceToOutcome(evidence: ComplianceEvidence): ScreeningOutcome {
  if (evidence.match.matchType === 'NEGATIVE_OBSERVATION') return 'CLEAR';
  if (evidence.classification === 'PEP') return 'REVIEW';
  if (evidence.classification === 'WANTED') return 'REVIEW';
  if (evidence.match.exactMatch) return 'REVIEW';
  if (evidence.match.fuzzyMatch) return 'REVIEW';
  if (evidence.quality.freshness === 'stale' || evidence.quality.freshness === 'expired') return 'HOLD';
  return 'REVIEW';
}

function evidenceToProviderResponse(
  evidence: ComplianceEvidence,
  request: ScreeningRequest,
): ProviderScreenResponse {
  const outcome = evidenceToOutcome(evidence);
  return Object.freeze({
    available: true,
    outcome,
    reasonCodes: Object.freeze([
      `EVIDENCE_${evidence.classification}`,
      evidence.match.exactMatch ? 'EXACT_MATCH' : evidence.match.fuzzyMatch ? 'FUZZY_MATCH' : 'POTENTIAL_MATCH',
    ]),
    providerRef: `${evidence.source.providerId}:${request.subjectRef}`,
    providerModel: evidence.provenance.normalizationVersion,
    providerHash: evidence.provenance.rawPayloadHash,
    confidence: evidence.quality.confidence,
    score: evidence.match.matchScore,
    evidenceRefs: Object.freeze([evidence.evidenceId]),
  });
}

/**
 * Collect external evidence and produce Kernel-safe facts.
 * Does NOT bypass ComplianceFabric.collectFacts — enriches evidence inputs only.
 */
export async function bridgeEvidenceToKernel(
  service: ComplianceScreeningEvidenceService,
  input: {
    readonly subjectRef: string;
    readonly subjectKind: ScreeningRequest['subjectKind'];
    readonly jurisdiction: string;
    readonly name: string;
    readonly aliases?: readonly string[];
    readonly dateOfBirth?: string | null;
    readonly nationality?: string | null;
    readonly now: UtcInstant;
  },
): Promise<EvidenceKernelBridgeResult> {
  const evidence = await service.searchEntity({
    subjectType: input.subjectKind === 'BUSINESS' ? 'ORGANIZATION' : 'PERSON',
    name: input.name,
    aliases: input.aliases,
    dateOfBirth: input.dateOfBirth,
    nationality: input.nationality,
    canonicalSubjectId: input.subjectRef,
    nowUtc: input.now,
  });

  const request: ScreeningRequest = Object.freeze({
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    jurisdiction: input.jurisdiction,
    now: input.now,
  });

  const positiveEvidence = evidence.filter((e) => e.match.matchType !== 'NEGATIVE_OBSERVATION');
  const hints = positiveEvidence.map((e) => evidenceToProviderResponse(e, request));
  const facts = hints.map((hint, i) =>
    screeningResponseToFact(
      classificationToScreeningType(positiveEvidence[i]!.classification),
      request,
      hint,
    ),
  );

  return Object.freeze({
    evidenceFacts: Object.freeze(facts),
    evidenceRefs: Object.freeze(evidence.map((e) => e.evidenceId)),
    providerHints: Object.freeze(hints),
    kernelDecides: true,
    separationProof: complianceSeparationProof(),
  });
}

export function kernelEscalationFromEvidenceFacts(
  current: import('../../../permissions/src/decision.ts').DecisionStatus,
  facts: ComplianceFacts,
): Escalation {
  return escalateFromComplianceFacts(current, facts);
}

export function evidenceGrantsExecutionAuthority(): false {
  return false;
}

export function agentMayBypassKernel(): false {
  return false;
}

export function exchangeMayBypassKernel(): false {
  return false;
}

export function blockchainConsensusDependsOnProvider(): false {
  return false;
}
