/**
 * Fraud signal detection for human contribution attestations.
 */

import type { ContributionAttestation } from './types.ts';

export type FraudSignalKind =
  | 'FORGED_ATTESTATION'
  | 'DUPLICATE_RECEIPT'
  | 'ISSUER_MISMATCH'
  | 'SIGNATURE_MISMATCH'
  | 'IMPOSSIBLE_TIMESTAMP'
  | 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS'
  | 'CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES'
  | 'PUBLICATION_AUTHOR_MISMATCH';

export type FraudSignal = {
  readonly kind: FraudSignalKind;
  readonly attestationId: string;
  readonly detail: string;
  readonly severity: 'REJECT' | 'REVIEW';
};

export type FraudDetectionContext = {
  readonly attestations: readonly ContributionAttestation[];
  readonly expectedSubjectRef: string;
  readonly expectedContributionEventRef: string;
  readonly evaluatedAt: string;
  readonly knownReceiptIds?: ReadonlySet<string>;
  readonly receiptActorMap?: ReadonlyMap<string, string>;
  readonly contributionIdentityMap?: ReadonlyMap<string, string>;
  readonly expectedPublicationAuthors?: readonly string[];
};

export function detectFraudSignals(context: FraudDetectionContext): readonly FraudSignal[] {
  const signals: FraudSignal[] = [];
  const receiptIds = new Map<string, string>();
  const signatureRefs = new Map<string, string>();

  for (const attestation of context.attestations) {
    if (attestation.verificationStatus === 'REJECTED') {
      signals.push({
        kind: 'FORGED_ATTESTATION',
        attestationId: attestation.attestationId,
        detail: 'Attestation marked rejected by issuer verification',
        severity: 'REJECT',
      });
    }

    if (attestation.subjectPseudonymousRef !== context.expectedSubjectRef) {
      signals.push({
        kind: 'CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES',
        attestationId: attestation.attestationId,
        detail: 'Attestation subject does not match expected pseudonymous actor',
        severity: 'REJECT',
      });
    }

    if (attestation.contributionEventRef !== context.expectedContributionEventRef) {
      signals.push({
        kind: 'ISSUER_MISMATCH',
        attestationId: attestation.attestationId,
        detail: 'Attestation contribution event reference mismatch',
        severity: 'REJECT',
      });
    }

    if (Date.parse(attestation.issuedAt) > Date.parse(context.evaluatedAt)) {
      signals.push({
        kind: 'IMPOSSIBLE_TIMESTAMP',
        attestationId: attestation.attestationId,
        detail: 'Attestation issued after evaluation time',
        severity: 'REJECT',
      });
    }

    if (attestation.signatureReference !== null) {
      const priorIssuer = signatureRefs.get(attestation.signatureReference);
      if (priorIssuer !== undefined && priorIssuer !== attestation.issuer) {
        signals.push({
          kind: 'SIGNATURE_MISMATCH',
          attestationId: attestation.attestationId,
          detail: 'Signature reference reused by different issuer',
          severity: 'REJECT',
        });
      }
      signatureRefs.set(attestation.signatureReference, attestation.issuer);
    }

    for (const evidenceRef of attestation.evidenceReferences) {
      const receiptKey = String(evidenceRef);
      const priorActor = receiptIds.get(receiptKey);
      if (priorActor !== undefined && priorActor !== String(attestation.subjectPseudonymousRef)) {
        signals.push({
          kind: 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS',
          attestationId: attestation.attestationId,
          detail: `Receipt ${receiptKey} claimed by multiple actors`,
          severity: 'REJECT',
        });
      }
      receiptIds.set(receiptKey, String(attestation.subjectPseudonymousRef));

      if (context.knownReceiptIds?.has(receiptKey)) {
        signals.push({
          kind: 'DUPLICATE_RECEIPT',
          attestationId: attestation.attestationId,
          detail: `Receipt ${receiptKey} already consumed`,
          severity: 'REJECT',
        });
      }

      const mappedActor = context.receiptActorMap?.get(receiptKey);
      if (mappedActor !== undefined && mappedActor !== String(attestation.subjectPseudonymousRef)) {
        signals.push({
          kind: 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS',
          attestationId: attestation.attestationId,
          detail: `Global receipt map shows actor mismatch for ${receiptKey}`,
          severity: 'REJECT',
        });
      }
    }

    const mappedIdentity = context.contributionIdentityMap?.get(String(attestation.contributionEventRef));
    if (mappedIdentity !== undefined && mappedIdentity !== String(attestation.subjectPseudonymousRef)) {
      signals.push({
        kind: 'CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES',
        attestationId: attestation.attestationId,
        detail: 'Same contribution event claimed under multiple identities',
        severity: 'REJECT',
      });
    }

    if (
      attestation.statementType === 'AUTHORSHIP' &&
      context.expectedPublicationAuthors !== undefined &&
      context.expectedPublicationAuthors.length > 0 &&
      !context.expectedPublicationAuthors.includes(attestation.issuer)
    ) {
      signals.push({
        kind: 'PUBLICATION_AUTHOR_MISMATCH',
        attestationId: attestation.attestationId,
        detail: 'Attestation issuer not in expected publication author set',
        severity: 'REVIEW',
      });
    }
  }

  return Object.freeze(signals);
}

export function fraudSignalsRequireRejection(signals: readonly FraudSignal[]): boolean {
  return signals.some((signal) => signal.severity === 'REJECT');
}

export function fraudSignalsRequireReview(signals: readonly FraudSignal[]): boolean {
  return signals.some((signal) => signal.severity === 'REVIEW');
}
