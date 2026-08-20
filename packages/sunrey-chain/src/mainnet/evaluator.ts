/**
 * Deterministic mainnet readiness evaluator.
 *
 * AUTHORIZED_CANDIDATE means the evidence record is complete according
 * to configured policy. It does not launch infrastructure.
 */

import { isExternalDimension } from './evidence.ts';
import { requiredHumanRolesPresent } from './authorization.ts';
import { readinessRecordHasVerifiedRegistryReference } from './external-evidence/bindings.ts';
import type { ExternalEvidenceRegistry } from './external-evidence/registry.ts';
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
  readonly requireExternalRegistry: boolean;
};

export type ReadinessEvaluationContext = {
  readonly registry?: ExternalEvidenceRegistry;
  readonly nowUtc?: string;
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
  requireExternalRegistry: true,
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
  requireExternalRegistry: false,
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
  context: ReadinessEvaluationContext,
): boolean {
  const rows = recordsFor(records, dimension);
  if (rows.length === 0) {
    return false;
  }
  const acceptable = isExternalDimension(dimension) ? policy.externalAcceptable : policy.engineeringAcceptable;
  const nowUtc = context.nowUtc ?? '1970-01-01T00:00:00.000Z';
  return rows.every((row) => {
    if (!(acceptable as readonly string[]).includes(row.verificationStatus)) {
      return false;
    }
    if (
      policy.requireExternalRegistry &&
      (isExternalDimension(dimension) || row.externalEvidence) &&
      row.verificationStatus !== 'NOT_APPLICABLE'
    ) {
      if (!context.registry) {
        return false;
      }
      return readinessRecordHasVerifiedRegistryReference(row, context.registry, nowUtc);
    }
    return true;
  });
}

export function evaluateReadiness(
  records: readonly ReadinessEvidenceRecord[],
  authorizations: readonly MainnetAuthorizationRecord[],
  policy: EvaluatorPolicy = DEFAULT_PRODUCTION_POLICY,
  context: ReadinessEvaluationContext = {},
): ReadinessEvaluatorStatus {
  const required = policy.requiredDimensions;
  const engineeringDims = required.filter((dimension) => !isExternalDimension(dimension));
  const externalDims = required.filter((dimension) => isExternalDimension(dimension));
  const engineeringComplete = engineeringDims.every((dimension) =>
    dimensionSatisfied(records, dimension, policy, context),
  );
  const externalComplete = externalDims.every((dimension) => dimensionSatisfied(records, dimension, policy, context));
  const humans = requiredHumanRolesPresent(authorizations);

  if (!engineeringComplete) {
    return 'INCOMPLETE';
  }
  if (!externalComplete) {
    const awaitingExternal = externalDims.some((dimension) => {
      const rows = recordsFor(records, dimension);
      return rows.some((row) => {
        if (
          row.verificationStatus === 'NOT_PROVIDED' ||
          row.verificationStatus === 'EXTERNAL_VERIFICATION_REQUIRED' ||
          row.verificationStatus === 'PROVIDED_UNVERIFIED'
        ) {
          return true;
        }
        if (policy.requireExternalRegistry && row.verificationStatus !== 'NOT_APPLICABLE') {
          if (!context.registry) {
            return true;
          }
          return !readinessRecordHasVerifiedRegistryReference(
            row,
            context.registry,
            context.nowUtc ?? '1970-01-01T00:00:00.000Z',
          );
        }
        return false;
      });
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
