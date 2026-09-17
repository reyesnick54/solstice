/**
 * HELIOS S3M-Finance serving integration.
 *
 * HELIOS consumes qualified S3M inference through the Model Gateway.
 * No direct S3M endpoint calls cross this boundary.
 */

import type { Clock } from '../../../config/src/clock.ts';
import {
  attributeS3mResearchUsage,
  S3mFinanceServingService,
  type S3mFinanceModelProfile,
  type S3mFinanceServingRequest,
  type S3mFinanceServingResponse,
  type S3mModelGatewayPort,
  type S3mResearchUsageAttribution,
} from '../s3m-finance/index.ts';
import type { S3mAvailabilityStatus } from '../s3m-finance/taxonomy.ts';

export type HeliosS3mServingRouteStatus = {
  readonly routeId: 'helios.s3m-finance.serving';
  readonly profileKey: 'S3M_FINANCE';
  readonly availabilityStatus: S3mAvailabilityStatus;
  readonly qualificationState: string;
  readonly deploymentHealth: string;
  readonly modelVersion: string;
  readonly evaluatedAt: string;
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

export type HeliosS3mServingRouteOptions = {
  readonly clock: Clock;
  readonly gateway: S3mModelGatewayPort;
  readonly profile?: S3mFinanceModelProfile;
};

export class HeliosS3mServingRoute {
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

  getModelProfile(): S3mFinanceModelProfile {
    return this.service.getModelProfile();
  }

  status(): HeliosS3mServingRouteStatus {
    const now = this.clock.now();
    const obs = this.service.observe();
    return Object.freeze({
      routeId: 'helios.s3m-finance.serving',
      profileKey: 'S3M_FINANCE',
      availabilityStatus: this.service.availabilityStatus(),
      qualificationState: obs.qualificationState,
      deploymentHealth: obs.deploymentHealth,
      modelVersion: obs.modelVersion,
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
    const usageAttribution = response.usage
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
}

export function createHeliosS3mServingRoute(options: HeliosS3mServingRouteOptions): HeliosS3mServingRoute {
  return new HeliosS3mServingRoute(options);
}
