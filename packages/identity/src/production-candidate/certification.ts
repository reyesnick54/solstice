import type { IdentityVerificationState } from './types.ts';

export const KYC_CERTIFICATION_CASES = [
  'start',
  'pending',
  'verified',
  'failed',
  'expired',
  'webhook_duplicate',
] as const;
export type KycCertificationCase = (typeof KYC_CERTIFICATION_CASES)[number];

export function expectedKycCertificationState(testCase: KycCertificationCase): IdentityVerificationState {
  switch (testCase) {
    case 'start':
    case 'pending':
      return 'IN_PROGRESS';
    case 'verified':
      return 'VERIFIED';
    case 'failed':
      return 'FAILED';
    case 'expired':
      return 'EXPIRED';
    case 'webhook_duplicate':
      return 'VERIFIED';
  }
}
