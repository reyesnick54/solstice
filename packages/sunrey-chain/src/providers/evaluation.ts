/**
 * Acceptance-state machine and production-eligibility derivation.
 *
 * Configured never equals approved. Production eligibility is derived
 * from the domain profile's configured requirements. AI cannot mark
 * HUMAN_ACCEPTED or PRODUCTION_ELIGIBLE.
 */

import { evidenceIsCurrent, licenseRemainsMissing, contractRemainsMissing } from './evidence.ts';
import { PROVIDER_CLASS_TO_EXTERNAL } from '../mainnet/external-evidence/bindings.ts';
import { profileFor } from './profiles.ts';
import {
  acceptanceErr,
  acceptanceOk,
  type AcceptanceState,
  type ExternalProviderEvidenceRecord,
  type ProviderAcceptanceResult,
  type ProviderAcceptanceResultRecord,
  type ProviderAcceptanceTestSuite,
  type ProviderProductionEligibilityEvaluation,
  type ReviewerKind,
} from './types.ts';

export type AcceptanceInputs = {
  readonly providerId: string;
  readonly domain: ProviderAcceptanceResultRecord['domain'];
  readonly configured: boolean;
  readonly suite: ProviderAcceptanceTestSuite | null;
  readonly evidence: readonly ExternalProviderEvidenceRecord[];
  readonly humanAccepted: boolean;
  readonly humanReviewerKind: ReviewerKind | null;
  readonly nowUtc: string;
  readonly externalRegistry?: import('./types.ts').ProviderExternalRegistryPort;
};

export function deriveAcceptanceState(input: AcceptanceInputs): AcceptanceState {
  if (!input.configured) {
    return 'NOT_CONFIGURED';
  }
  if (!input.suite?.engineeringTested) {
    return 'CONFIGURED_UNVERIFIED';
  }
  const profile = profileFor(input.domain);
  const currentRequired = profile.requiredEvidenceClasses.every((cls) =>
    input.evidence.some((row) => row.evidenceClass === cls && evidenceIsCurrent(row, input.nowUtc)),
  );
  const anyRequiredMissing = profile.requiredEvidenceClasses.some((cls) => {
    const row = input.evidence.find((item) => item.evidenceClass === cls);
    return !row || row.verificationState === 'MISSING' || row.documentOrReferenceId.length === 0;
  });
  if (anyRequiredMissing && input.evidence.length === 0) {
    return 'ENGINEERING_TESTED';
  }
  if (anyRequiredMissing) {
    return 'EXTERNAL_EVIDENCE_REQUIRED';
  }
  const anyStale = input.evidence.some((row) => {
    const profileNeeds = profile.requiredEvidenceClasses.includes(row.evidenceClass);
    return profileNeeds && !evidenceIsCurrent(row, input.nowUtc);
  });
  if (anyStale) {
    return 'EXTERNAL_EVIDENCE_REQUIRED';
  }
  if (!currentRequired) {
    return 'EXTERNAL_EVIDENCE_REQUIRED';
  }
  if (!input.humanAccepted || input.humanReviewerKind !== 'HUMAN') {
    return 'EXTERNAL_EVIDENCE_PROVIDED';
  }
  const humanReviewedRequired = profile.requiredEvidenceClasses.every((cls) =>
    input.evidence.some((row) => row.evidenceClass === cls && row.verificationState === 'HUMAN_REVIEWED'),
  );
  if (!humanReviewedRequired) {
    return 'HUMAN_ACCEPTED';
  }
  if (input.externalRegistry) {
    const registryOk = profile.requiredEvidenceClasses.every((cls) =>
      input.externalRegistry!.productionEligible({
        evidenceClass: PROVIDER_CLASS_TO_EXTERNAL[cls],
        subjectType: 'PROVIDER',
        subjectId: input.providerId,
        providerDomain: input.domain,
        nowUtc: input.nowUtc,
        production: true,
      }),
    );
    if (!registryOk) {
      return 'EXTERNAL_EVIDENCE_REQUIRED';
    }
  }
  return 'PRODUCTION_ELIGIBLE';
}

export function evaluateEligibility(input: AcceptanceInputs): ProviderProductionEligibilityEvaluation {
  const profile = profileFor(input.domain);
  const missing: string[] = [];
  if (!input.configured) {
    missing.push('configured');
  }
  if (!input.suite?.engineeringTested) {
    missing.push('engineering_tested');
  }
  for (const cls of profile.requiredEvidenceClasses) {
    const row = input.evidence.find((item) => item.evidenceClass === cls);
    if (!row || row.documentOrReferenceId.length === 0 || row.verificationState === 'MISSING') {
      missing.push(`evidence:${cls}:MISSING`);
      continue;
    }
    if (!evidenceIsCurrent(row, input.nowUtc)) {
      missing.push(`evidence:${cls}:STALE`);
    }
    if (row.verificationState !== 'HUMAN_REVIEWED') {
      missing.push(`evidence:${cls}:HUMAN_REVIEW_REQUIRED`);
    }
    if (input.externalRegistry) {
      const mapped = PROVIDER_CLASS_TO_EXTERNAL[cls];
      const registryOk = input.externalRegistry.productionEligible({
        evidenceClass: mapped,
        subjectType: 'PROVIDER',
        subjectId: input.providerId,
        providerDomain: input.domain,
        nowUtc: input.nowUtc,
        production: true,
      });
      if (!registryOk) {
        missing.push(`evidence:${cls}:REGISTRY_NOT_CURRENT`);
      }
    }
  }
  if (input.evidence.some(contractRemainsMissing)) {
    missing.push('missing_contract_stays_missing');
  }
  if (input.evidence.some(licenseRemainsMissing)) {
    missing.push('missing_license_stays_missing');
  }
  if (!input.humanAccepted) {
    missing.push('human_accepted');
  }
  if (input.humanReviewerKind === 'AI') {
    missing.push('ai_cannot_human_accept');
  }
  return Object.freeze({
    providerId: input.providerId,
    domain: input.domain,
    state: missing.length === 0 ? 'PRODUCTION_ELIGIBLE' : deriveAcceptanceState(input),
    productionEligible: missing.length === 0,
    configuredEqualsApproved: false,
    missingRequirements: Object.freeze(missing),
    derivedFromConfiguredRequirements: true,
  });
}

export function recordAcceptance(input: AcceptanceInputs): ProviderAcceptanceResultRecord {
  const eligibility = evaluateEligibility(input);
  const state = deriveAcceptanceState(input);
  const expirationWarnings = input.evidence
    .filter((row) => row.expiresAtUtc !== null)
    .filter((row) => !evidenceIsCurrent(row, input.nowUtc))
    .map((row) => `${row.evidenceClass} expired at ${row.expiresAtUtc}`);
  return Object.freeze({
    providerId: input.providerId,
    domain: input.domain,
    configured: input.configured,
    engineeringTested: input.suite?.engineeringTested === true,
    externalEvidenceSatisfied: eligibility.missingRequirements.every((row) => !row.startsWith('evidence:')),
    humanAccepted: input.humanAccepted && input.humanReviewerKind === 'HUMAN',
    productionEligible: eligibility.productionEligible,
    state,
    expirationWarnings: Object.freeze(expirationWarnings),
    capabilities: Object.freeze(
      (input.suite?.cases ?? []).map((row) =>
        Object.freeze({
          capability: row.name,
          supported: row.outcome === 'PASS',
          inferred: false as const,
          evidenceSource: row.caseId,
          hardwareBound: input.domain === 'HSM',
        }),
      ),
    ),
  });
}

export function attemptHumanAcceptance(input: {
  readonly reviewerKind: ReviewerKind;
  readonly reviewerId: string;
}): ProviderAcceptanceResult<{ readonly humanAccepted: true; readonly reviewerId: string }> {
  if (input.reviewerKind === 'AI') {
    return acceptanceErr(
      'AI_CANNOT_HUMAN_ACCEPT',
      'AI cannot mark HUMAN_ACCEPTED or PRODUCTION_ELIGIBLE where human acceptance is required',
    );
  }
  if (input.reviewerId.length === 0) {
    return acceptanceErr('REVIEWER_REQUIRED', 'configured human reviewer role is required');
  }
  return acceptanceOk({ humanAccepted: true, reviewerId: input.reviewerId });
}

export function configuredIsNotApproved(configured: boolean, productionEligible: boolean): boolean {
  return configured && !productionEligible;
}
