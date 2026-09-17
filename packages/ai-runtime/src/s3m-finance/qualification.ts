import type { UtcInstant } from '../../../domain/src/time.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import { withQualificationState } from './model-profile.ts';
import type { S3mAvailabilityStatus, S3mFinanceQualificationState } from './taxonomy.ts';
import {
  s3mQualificationPermitsPrivateContext,
  s3mQualificationPermitsServing,
} from './taxonomy.ts';

export type S3mQualificationCheck = {
  readonly state: S3mFinanceQualificationState;
  readonly permitsServing: boolean;
  readonly permitsPrivateContext: boolean;
  readonly modelVersion: string;
  readonly deploymentId: string;
  readonly endpointServiceIdentity: string | null;
  readonly evaluatedAt: UtcInstant;
};

export function evaluateQualification(profile: S3mFinanceModelProfile, now: UtcInstant): S3mQualificationCheck {
  return Object.freeze({
    state: profile.qualificationState,
    permitsServing: s3mQualificationPermitsServing(profile.qualificationState),
    permitsPrivateContext: s3mQualificationPermitsPrivateContext(profile.qualificationState),
    modelVersion: profile.modelVersion,
    deploymentId: profile.deploymentId,
    endpointServiceIdentity: profile.endpointServiceIdentity,
    evaluatedAt: now,
  });
}

export function resolveAvailabilityStatus(profile: S3mFinanceModelProfile): S3mAvailabilityStatus {
  if (s3mQualificationPermitsServing(profile.qualificationState)) {
    return 'S3M_CONTRACT_READY';
  }
  return 'S3M_EXTERNAL_DEPLOYMENT_QUALIFICATION_PENDING';
}

export function approveQualification(
  profile: S3mFinanceModelProfile,
  input: {
    readonly state: 'QUALIFIED_SANDBOX' | 'QUALIFIED_PRIVATE_CONTEXT';
    readonly evidenceRef: string;
    readonly approvalDate: UtcInstant;
    readonly endpointServiceIdentity: string;
    readonly deploymentId?: string;
  },
): S3mFinanceModelProfile {
  return withQualificationState(profile, input.state, {
    approvalEvidenceRef: input.evidenceRef,
    approvalDate: input.approvalDate,
    endpointServiceIdentity: input.endpointServiceIdentity,
    healthState: 'HEALTHY',
    supportsTools: true,
    ...(input.deploymentId ? {} : {}),
  });
}

export function verifyDeploymentIdentity(
  profile: S3mFinanceModelProfile,
  expectedDeploymentId: string,
  expectedServiceIdentity: string | null,
): boolean {
  if (profile.deploymentId !== expectedDeploymentId) {
    return false;
  }
  if (expectedServiceIdentity !== null && profile.endpointServiceIdentity !== expectedServiceIdentity) {
    return false;
  }
  return true;
}
