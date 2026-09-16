import type { Clock } from '../../../../config/src/clock.ts';
import {
  attributeS3mResearchUsage,
  S3mFinanceServingService,
  type S3mFinanceModelProfile,
  type S3mFinanceServingRequest,
  type S3mModelGatewayPort,
} from '../../../../ai-runtime/src/s3m-finance/index.ts';
import { heliosS3mSpendBridge } from './usage-bridge.ts';
import type { HeliosS3mServingPort, HeliosS3mServingResult, HeliosS3mServingRouteStatus } from './types.ts';

export type HeliosS3mServingRouteOptions = {
  readonly clock: Clock;
  readonly gateway: S3mModelGatewayPort;
  readonly profile?: S3mFinanceModelProfile;
};

/**
 * HELIOS route for qualified S3M-Finance inference.
 * Consumes Model Gateway → S3M adapter → qualified deployment.
 * Does not call S3M endpoints directly.
 */
export class HeliosS3mServingRoute implements HeliosS3mServingPort {
  private readonly clock: Clock;
  private readonly service: S3mFinanceServingService;

  constructor(options: HeliosS3mServingRouteOptions) {
    this.clock = options.clock;
    this.service = new S3mFinanceServingService({
      clock: options.clock,
      gateway: options.gateway,
      ...(options.profile ? { profile: options.profile } : {}),
    });
  }

  getModelProfile() {
    return this.service.getModelProfile();
  }

  status(): HeliosS3mServingRouteStatus {
    const now = this.clock.now();
    return Object.freeze({
      routeId: 'helios.s3m-finance.serving',
      profileKey: 'S3M_FINANCE',
      availabilityStatus: this.service.availabilityStatus(),
      qualification: this.service.qualification(),
      observability: this.service.observe(),
      evaluatedAt: now,
    });
  }

  infer(request: S3mFinanceServingRequest): HeliosS3mServingResult {
    const route = this.status();
    const result = this.service.infer(request);
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        code: result.error.code,
        message: result.error.detail,
        route,
        fallbackPolicy: result.error.fallbackPolicy,
      });
    }
    const response = result.value;
    const usageAttribution =
      response.usage
        ? attributeS3mResearchUsage({
            inferenceRequestId: request.inferenceRequestId,
            workOrderRef: request.workOrderRef,
            taskRef: request.taskRef,
            providerId: 'S3M',
            modelId: response.modelId,
            usage: response.usage,
            recordedAt: response.timing.completedAt,
          })
        : null;
    return Object.freeze({
      ok: true,
      response,
      route,
      usageAttribution,
    });
  }

  cancel(requestId: string): boolean {
    return this.service.cancel(requestId);
  }

  spendBridge = heliosS3mSpendBridge;
}

export function createHeliosS3mServingRoute(options: HeliosS3mServingRouteOptions): HeliosS3mServingRoute {
  return new HeliosS3mServingRoute(options);
}
