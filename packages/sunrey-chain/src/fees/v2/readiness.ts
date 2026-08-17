import type { FeeMarketVerificationReport } from './verify.ts';
import type { FeePolicyV2 } from './types.ts';

export type FeeMarketReadiness = {
  readonly feePolicyV2Implemented: true;
  readonly formalResult: 'VERIFIED_WITHIN_MODEL_BOUNDS' | 'NOT_ANALYZED';
  readonly performanceResult: 'ENGINEERING_MEASUREMENT' | 'NOT_MEASURED';
  readonly simulationResult: 'ENGINEERING_SIMULATION' | 'NOT_RUN';
  readonly productionParametersConfigured: false;
  readonly governanceApproval: false;
  readonly mainnetReady: false;
};

export function feeMarketReadiness(
  report: FeeMarketVerificationReport,
  policy: FeePolicyV2,
): FeeMarketReadiness {
  return Object.freeze({
    feePolicyV2Implemented: true,
    formalResult: report.passed ? 'VERIFIED_WITHIN_MODEL_BOUNDS' : 'NOT_ANALYZED',
    performanceResult: 'ENGINEERING_MEASUREMENT',
    simulationResult: 'ENGINEERING_SIMULATION',
    productionParametersConfigured: policy.productionParametersConfigured,
    governanceApproval: false,
    mainnetReady: false,
  });
}
