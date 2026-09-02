import type { UtcInstant } from '../../../../domain/src/time.ts';
import { commitRightsDomain, scopeCommitmentFromLabels, subjectCommitment } from '../rights/commitments.ts';
import { HUMAN_ECONOMY_COMMITMENT_DOMAINS } from './taxonomy.ts';
import { newAuthorizedContributionId, newOffChainRecordRefId } from './ids.ts';
import type {
  AuthorizedComputationParticipation,
  AuthorizedContribution,
  AuthorizedDatasetContribution,
  MinimumNecessaryProof,
  OffChainRecordReference,
} from './types.ts';
import { HUMAN_ECONOMY_SCHEMA_VERSION } from './taxonomy.ts';
import type { HumanDataClassification, HumanEconomyPurposeCode } from './taxonomy.ts';
import type { HumanEconomyConsentGrantId } from './ids.ts';

export type RawDataContributionAttempt = {
  readonly rawPayload: string;
  readonly classification: HumanDataClassification;
};

/**
 * Raw sensitive data is never an authorized contribution.
 */
export function isRawDataContribution(_attempt: RawDataContributionAttempt): false {
  return false;
}

export function buildAuthorizedDatasetContribution(input: {
  readonly seed: string;
  readonly subjectRef: string;
  readonly jurisdiction: string;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly authorizedComputationRef: string;
  readonly dataClassification: HumanDataClassification;
  readonly offChainRecordSeed: string;
  readonly occurredAt: UtcInstant;
}): AuthorizedDatasetContribution {
  const offChainRecordRef = newOffChainRecordRefId(input.offChainRecordSeed);
  const onChainCommitment = commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.OFF_CHAIN_RECORD_REF, {
    recordRefId: offChainRecordRef,
    classification: input.dataClassification,
    computationRef: input.authorizedComputationRef,
  });

  return Object.freeze({
    schemaVersion: HUMAN_ECONOMY_SCHEMA_VERSION,
    contributionId: newAuthorizedContributionId(input.seed),
    kind: 'AUTHORIZED_DATASET_CONTRIBUTION',
    subjectCommitment: subjectCommitment(input.subjectRef, input.jurisdiction),
    humanConsentGrantId: input.humanConsentGrantId,
    purposeCode: input.purposeCode,
    authorizedComputationRef: input.authorizedComputationRef,
    dataClassification: input.dataClassification,
    offChainRecordRef,
    onChainCommitment,
    rawDataOnChain: false,
    occurredAt: input.occurredAt,
  });
}

export function buildAuthorizedComputationParticipation(input: {
  readonly seed: string;
  readonly subjectRef: string;
  readonly jurisdiction: string;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly computationRef: string;
  readonly resultEvidenceRef: string;
  readonly occurredAt: UtcInstant;
}): AuthorizedComputationParticipation {
  return Object.freeze({
    schemaVersion: HUMAN_ECONOMY_SCHEMA_VERSION,
    contributionId: newAuthorizedContributionId(input.seed),
    kind: 'AUTHORIZED_COMPUTATION_PARTICIPATION',
    subjectCommitment: subjectCommitment(input.subjectRef, input.jurisdiction),
    humanConsentGrantId: input.humanConsentGrantId,
    purposeCode: input.purposeCode,
    computationRef: input.computationRef,
    computationCompleted: true,
    resultEvidenceRef: input.resultEvidenceRef,
    rawDataOnChain: false,
    occurredAt: input.occurredAt,
  });
}

export function isAuthorizedContribution(value: AuthorizedContribution | RawDataContributionAttempt): value is AuthorizedContribution {
  return 'contributionId' in value && 'rawDataOnChain' in value;
}

export function contributionCommitment(contribution: AuthorizedContribution): string {
  const common = {
    schemaVersion: contribution.schemaVersion,
    contributionId: contribution.contributionId,
    kind: contribution.kind,
    subjectCommitment: contribution.subjectCommitment,
    humanConsentGrantId: contribution.humanConsentGrantId,
    purposeCode: contribution.purposeCode,
    occurredAt: contribution.occurredAt,
    rawDataOnChain: contribution.rawDataOnChain,
  };

  if (contribution.kind === 'AUTHORIZED_DATASET_CONTRIBUTION') {
    return commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.AUTHORIZED_CONTRIBUTION, {
      ...common,
      authorizedComputationRef: contribution.authorizedComputationRef,
      dataClassification: contribution.dataClassification,
      offChainRecordRef: contribution.offChainRecordRef,
      onChainCommitment: contribution.onChainCommitment,
    });
  }

  return commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.AUTHORIZED_CONTRIBUTION, {
    ...common,
    computationRef: contribution.computationRef,
    computationCompleted: contribution.computationCompleted,
    resultEvidenceRef: contribution.resultEvidenceRef,
  });
}

export function buildOffChainRecordReference(input: {
  readonly seed: string;
  readonly classification: HumanDataClassification;
  readonly scopeLabels: readonly string[];
  readonly deletedAt?: UtcInstant | null;
  readonly expiresAt?: UtcInstant | null;
}): OffChainRecordReference {
  const recordRefId = newOffChainRecordRefId(input.seed);
  const commitment = commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.OFF_CHAIN_RECORD_REF, {
    recordRefId,
    classification: input.classification,
    scopeCommitment: scopeCommitmentFromLabels(input.scopeLabels),
  });

  return Object.freeze({
    schemaVersion: HUMAN_ECONOMY_SCHEMA_VERSION,
    recordRefId,
    commitment,
    classification: input.classification,
    deletedAt: input.deletedAt ?? null,
    expiresAt: input.expiresAt ?? null,
  });
}

export function minimumNecessaryProofSufficient(proof: MinimumNecessaryProof | undefined): boolean {
  return proof !== undefined && proof.valid === true && proof.underlyingRecordRequired === false;
}
