import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  S3mAvailabilityStatus,
  S3mFinanceModelProfile,
  S3mFinanceObservabilitySnapshot,
  S3mFinanceServingRequest,
  S3mFinanceServingResponse,
  S3mQualificationCheck,
  S3mResearchUsageAttribution,
} from '../../../../ai-runtime/src/s3m-finance/index.ts';
import type { ResearchSpendRecord } from '../execution-types.ts';

export type HeliosS3mServingRouteStatus = {
  readonly routeId: 'helios.s3m-finance.serving';
  readonly profileKey: 'S3M_FINANCE';
  readonly availabilityStatus: S3mAvailabilityStatus;
  readonly qualification: S3mQualificationCheck;
  readonly observability: S3mFinanceObservabilitySnapshot;
  readonly evaluatedAt: UtcInstant;
};

export type HeliosS3mServingResult =
  | {
      readonly ok: true;
      readonly response: S3mFinanceServingResponse;
      readonly route: HeliosS3mServingRouteStatus;
      readonly usageAttribution: S3mResearchUsageAttribution | null;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly route: HeliosS3mServingRouteStatus;
      readonly fallbackPolicy: S3mFinanceServingRequest['fallbackPolicy'];
    };

export type HeliosS3mServingPort = {
  readonly getModelProfile: () => S3mFinanceModelProfile;
  readonly status: (now: UtcInstant) => HeliosS3mServingRouteStatus;
  readonly infer: (request: S3mFinanceServingRequest) => HeliosS3mServingResult;
  readonly cancel: (requestId: string) => boolean;
};

export type HeliosS3mSpendBridgeInput = {
  readonly attribution: S3mResearchUsageAttribution;
  readonly workOrderId: import('../ids.ts').EconomicWorkOrderId;
  readonly taskId: import('../ids.ts').HeliosTaskId;
  readonly customerId: string;
  readonly programId: import('../ids.ts').HeliosProgramId;
  readonly reservedAmount: string;
  readonly attemptNumber: number;
  readonly retryCausedAdditionalCost: boolean;
  readonly succeeded: boolean;
  readonly now: UtcInstant;
};

export type HeliosS3mSpendBridge = {
  readonly toResearchSpendRecord: (input: HeliosS3mSpendBridgeInput) => ResearchSpendRecord;
};
