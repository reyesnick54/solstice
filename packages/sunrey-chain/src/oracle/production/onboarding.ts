import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { commitCanonical } from '../../hash.ts';
import type {
  EvidenceConfirmationState,
  OnboardingEvidence,
  OnboardingStatus,
  OracleProviderOnboardingRecord,
  ProductionOracleRejection,
  SigningKeyRecord,
} from './types.ts';
import { missingContractIsNeverConfirmed } from './types.ts';

const PROMOTIONS: Readonly<Record<OnboardingStatus, readonly OnboardingStatus[]>> = Object.freeze({
  DRAFT: ['TECHNICALLY_VALIDATED', 'REVOKED'],
  TECHNICALLY_VALIDATED: ['TESTNET_ACTIVE', 'SUSPENDED', 'REVOKED'],
  TESTNET_ACTIVE: ['PRODUCTION_CANDIDATE', 'SUSPENDED', 'REVOKED'],
  PRODUCTION_CANDIDATE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['TESTNET_ACTIVE', 'REVOKED'],
  REVOKED: [],
});

export function emptyOnboardingEvidence(): OnboardingEvidence {
  return Object.freeze({
    schemaVersion: 1,
    technicalValidationRef: null,
    securityReviewRef: null,
    securityReviewStatus: 'NOT_REVIEWED',
    commercialAgreementRef: null,
    commercialAgreementState: 'NOT_PROVIDED',
    dataLicenseRef: null,
    jurisdictionReviewRef: null,
    usageRightsRef: null,
    missingContractIsConfirmed: missingContractIsNeverConfirmed(),
  });
}

export function productionEligibilityRequiresEvidence(record: OracleProviderOnboardingRecord): boolean {
  return (
    record.onboardingEvidence.commercialAgreementState === 'CONFIRMED' &&
    record.onboardingEvidence.commercialAgreementRef !== null &&
    record.onboardingEvidence.securityReviewStatus === 'REVIEWED_WITH_EVIDENCE' &&
    record.onboardingEvidence.securityReviewRef !== null &&
    record.onboardingEvidence.technicalValidationRef !== null &&
    record.onboardingEvidence.missingContractIsConfirmed === false
  );
}

export function computeProductionEligibility(record: OracleProviderOnboardingRecord): boolean {
  return record.status === 'PRODUCTION_CANDIDATE' && productionEligibilityRequiresEvidence(record);
}

export function createOnboardingDraft(
  input: Omit<OracleProviderOnboardingRecord, 'schemaVersion' | 'productionEligibility' | 'status'> & {
    readonly status?: OnboardingStatus;
  },
): Result<OracleProviderOnboardingRecord, ProductionOracleRejection> {
  if (input.providerId.length === 0 || input.controllerReference.length === 0) {
    return err({ code: 'INVALID_IDENTIFIER', detail: 'provider and controller are required' });
  }
  if (input.signingKey.publicKeyHex.length === 0) {
    return err({ code: 'SIGNING_FAILED', detail: 'signing public key required; private keys are never stored' });
  }
  const draft: OracleProviderOnboardingRecord = Object.freeze({
    ...input,
    schemaVersion: 1,
    status: input.status ?? 'DRAFT',
    productionEligibility: false,
    onboardingEvidence: Object.freeze({
      ...input.onboardingEvidence,
      missingContractIsConfirmed: missingContractIsNeverConfirmed(),
    }),
  });
  return ok(Object.freeze({ ...draft, productionEligibility: computeProductionEligibility(draft) }));
}

export function transitionOnboarding(
  record: OracleProviderOnboardingRecord,
  next: OnboardingStatus,
): Result<OracleProviderOnboardingRecord, ProductionOracleRejection> {
  if (!PROMOTIONS[record.status].includes(next)) {
    return err({
      code: 'PROVIDER_NOT_ELIGIBLE',
      detail: `cannot move ${record.status} to ${next}`,
    });
  }
  if (next === 'PRODUCTION_CANDIDATE' && !productionEligibilityRequiresEvidence({ ...record, status: next })) {
    return err({
      code: 'AGREEMENT_EVIDENCE_MISSING',
      detail: 'production eligibility requires configured agreement, security, and technical evidence',
    });
  }
  const updated = Object.freeze({ ...record, status: next });
  return ok(Object.freeze({ ...updated, productionEligibility: computeProductionEligibility(updated) }));
}

export function attachOnboardingEvidence(
  record: OracleProviderOnboardingRecord,
  evidence: Partial<OnboardingEvidence>,
): OracleProviderOnboardingRecord {
  const commercialState: EvidenceConfirmationState =
    evidence.commercialAgreementState ?? record.onboardingEvidence.commercialAgreementState;
  const next = Object.freeze({
    ...record,
    onboardingEvidence: Object.freeze({
      ...record.onboardingEvidence,
      ...evidence,
      commercialAgreementState: commercialState,
      missingContractIsConfirmed: missingContractIsNeverConfirmed(),
    }),
    commercialAgreementEvidenceReference:
      evidence.commercialAgreementRef ?? record.commercialAgreementEvidenceReference,
    securityReviewStatus: evidence.securityReviewStatus ?? record.securityReviewStatus,
  });
  return Object.freeze({ ...next, productionEligibility: computeProductionEligibility(next) });
}

export function rotateSigningKey(
  record: OracleProviderOnboardingRecord,
  nextKey: SigningKeyRecord,
): Result<OracleProviderOnboardingRecord, ProductionOracleRejection> {
  if (nextKey.rotatedFromKeyId !== record.signingKey.keyId) {
    return err({ code: 'SIGNING_FAILED', detail: 'rotation must reference the prior key' });
  }
  if (nextKey.keyVersion <= record.signingKey.keyVersion) {
    return err({ code: 'SIGNING_FAILED', detail: 'rotated key version must increase' });
  }
  return ok(
    Object.freeze({
      ...record,
      signingKey: Object.freeze({ ...nextKey, active: true }),
      cryptoSuite: nextKey.cryptoSuite,
    }),
  );
}

export function onboardingEvidenceHash(record: OracleProviderOnboardingRecord): string {
  return commitCanonical({
    domain: 'sunrey.oracle.onboarding.v1',
    providerId: record.providerId,
    status: record.status,
    evidence: record.onboardingEvidence,
    productionEligibility: record.productionEligibility,
  });
}

export class OracleOnboardingRegistry {
  private readonly records = new Map<string, OracleProviderOnboardingRecord>();
  private readonly keyHistory = new Map<string, SigningKeyRecord[]>();

  put(record: OracleProviderOnboardingRecord): Result<OracleProviderOnboardingRecord, ProductionOracleRejection> {
    this.records.set(record.providerId, record);
    const history = this.keyHistory.get(record.providerId) ?? [];
    if (!history.some((row) => row.keyId === record.signingKey.keyId && row.keyVersion === record.signingKey.keyVersion)) {
      this.keyHistory.set(record.providerId, [...history, record.signingKey]);
    }
    return ok(record);
  }

  get(providerId: string): OracleProviderOnboardingRecord | undefined {
    return this.records.get(providerId);
  }

  list(): readonly OracleProviderOnboardingRecord[] {
    return [...this.records.values()].sort((a, b) => (a.providerId < b.providerId ? -1 : 1));
  }

  historicalKeys(providerId: string): readonly SigningKeyRecord[] {
    return this.keyHistory.get(providerId) ?? [];
  }

  eligibleForObservation(providerId: string): Result<OracleProviderOnboardingRecord, ProductionOracleRejection> {
    const record = this.records.get(providerId);
    if (!record) {
      return err({ code: 'PROVIDER_NOT_ONBOARDED', detail: providerId });
    }
    if (record.status === 'SUSPENDED') {
      return err({ code: 'PROVIDER_SUSPENDED', detail: providerId });
    }
    if (record.status === 'REVOKED') {
      return err({ code: 'PROVIDER_REVOKED', detail: providerId });
    }
    if (record.status === 'DRAFT') {
      return err({ code: 'PROVIDER_NOT_ELIGIBLE', detail: 'draft providers cannot emit eligible observations' });
    }
    return ok(record);
  }
}
