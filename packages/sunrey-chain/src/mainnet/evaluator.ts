/**
 * Deterministic mainnet readiness evaluator.
 *
 * AUTHORIZED_CANDIDATE means the evidence record is complete according
 * to configured policy. It does not launch infrastructure.
 */

import { isExternalDimension } from './evidence.ts';
import { requiredHumanRolesPresent } from './authorization.ts';
import type {
  MainnetAuthorizationRecord,
  MainnetReadinessDimension,
  ReadinessEvaluatorStatus,
  ReadinessEvidenceRecord,
} from './types.ts';

export type EvaluatorPolicy = {
  readonly requiredDimensions: readonly MainnetReadinessDimension[];
  readonly engineeringAcceptable: readonly ReadinessEvidenceRecord['verificationStatus'][];
  readonly externalAcceptable: readonly ReadinessEvidenceRecord['verificationStatus'][];
};

export const DEFAULT_PRODUCTION_POLICY = {
  requiredDimensions: [
    'PROTOCOL',
    'CONSENSUS',
    'FORMAL_ASSURANCE',
    'SECURITY_TESTING',
    'EXTERNAL_SECURITY_REVIEW',
    'CRYPTOGRAPHY',
    'PQC',
    'SUPPLY_CHAIN',
    'RELEASE',
    'VALIDATOR_OPERATIONS',
    'VALIDATOR_ECONOMICS',
    'ROOT_OF_TRUST',
    'GENESIS',
    'OBSERVABILITY',
    'DISASTER_RECOVERY',
    'PERFORMANCE',
    'PRIVACY',
    'CUSTODY',
    'EXCHANGE',
    'COMPLIANCE',
    'LEGAL',
    'REGULATORY',
    'LICENSING',
    'PARTNER_DEPENDENCIES',
    'HUMAN_AUTHORIZATION',
    'INFRASTRUCTURE',
  ],
  engineeringAcceptable: ['ENGINEERING_VERIFIED', 'HUMAN_VERIFIED', 'NOT_APPLICABLE'],
  externalAcceptable: ['HUMAN_VERIFIED', 'NOT_APPLICABLE'],
} as const satisfies EvaluatorPolicy;

export const ENGINEERING_ONLY_POLICY = {
  requiredDimensions: [
    'PROTOCOL',
    'CONSENSUS',
    'SECURITY_TESTING',
    'CRYPTOGRAPHY',
    'PQC',
    'SUPPLY_CHAIN',
    'RELEASE',
    'VALIDATOR_OPERATIONS',
    'VALIDATOR_ECONOMICS',
    'GENESIS',
    'OBSERVABILITY',
    'DISASTER_RECOVERY',
    'PERFORMANCE',
    'INFRASTRUCTURE',
  ],
  engineeringAcceptable: ['ENGINEERING_VERIFIED', 'HUMAN_VERIFIED', 'NOT_APPLICABLE'],
  externalAcceptable: ['HUMAN_VERIFIED', 'NOT_APPLICABLE', 'ENGINEERING_VERIFIED'],
} as const satisfies EvaluatorPolicy;

function recordsFor(
  records: readonly ReadinessEvidenceRecord[],
  dimension: MainnetReadinessDimension,
): readonly ReadinessEvidenceRecord[] {
  return records.filter((record) => record.dimension === dimension);
}

function dimensionSatisfied(
  records: readonly ReadinessEvidenceRecord[],
  dimension: MainnetReadinessDimension,
  policy: EvaluatorPolicy,
): boolean {
  const rows = recordsFor(records, dimension);
  if (rows.length === 0) {
    return false;
  }
  const acceptable = isExternalDimension(dimension) ? policy.externalAcceptable : policy.engineeringAcceptable;
  return rows.every((row) => (acceptable as readonly string[]).includes(row.verificationStatus));
}

export function evaluateReadiness(
  records: readonly ReadinessEvidenceRecord[],
  authorizations: readonly MainnetAuthorizationRecord[],
  policy: EvaluatorPolicy = DEFAULT_PRODUCTION_POLICY,
): ReadinessEvaluatorStatus {
  const required = policy.requiredDimensions;
  const engineeringDims = required.filter((dimension) => !isExternalDimension(dimension));
  const externalDims = required.filter((dimension) => isExternalDimension(dimension));
  const engineeringComplete = engineeringDims.every((dimension) => dimensionSatisfied(records, dimension, policy));
  const externalComplete = externalDims.every((dimension) => dimensionSatisfied(records, dimension, policy));
  const humans = requiredHumanRolesPresent(authorizations);

  if (!engineeringComplete) {
    return 'INCOMPLETE';
  }
  if (!externalComplete) {
    const awaitingExternal = externalDims.some((dimension) => {
      const rows = recordsFor(records, dimension);
      return rows.some(
        (row) =>
          row.verificationStatus === 'NOT_PROVIDED' ||
          row.verificationStatus === 'EXTERNAL_VERIFICATION_REQUIRED' ||
          row.verificationStatus === 'PROVIDED_UNVERIFIED',
      );
    });
    if (awaitingExternal) {
      return 'AWAITING_EXTERNAL_EVIDENCE';
    }
    return 'ENGINEERING_READY_FOR_HUMAN_REVIEW';
  }
  if (!humans) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  return 'AUTHORIZED_CANDIDATE';
}

export function missingSecurityReportAppearsVerified(
  records: readonly ReadinessEvidenceRecord[],
): boolean {
  return records.some(
    (row) =>
      row.dimension === 'EXTERNAL_SECURITY_REVIEW' &&
      row.evidenceHash === null &&
      (row.verificationStatus === 'ENGINEERING_VERIFIED' || row.verificationStatus === 'HUMAN_VERIFIED'),
  );
}

export function missingHumanAuthorizationAppearsAuthorized(
  status: ReadinessEvaluatorStatus,
  authorizations: readonly MainnetAuthorizationRecord[],
): boolean {
  return status === 'AUTHORIZED_CANDIDATE' && !requiredHumanRolesPresent(authorizations);
}
