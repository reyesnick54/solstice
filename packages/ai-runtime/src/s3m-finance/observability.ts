import type { UtcInstant } from '../../../domain/src/time.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import type { S3mFinanceHealthState, S3mFinanceQualificationState } from './taxonomy.ts';

export type S3mFinanceObservabilitySnapshot = {
  readonly deploymentHealth: S3mFinanceHealthState;
  readonly qualificationState: S3mFinanceQualificationState;
  readonly modelVersion: string;
  readonly deploymentId: string;
  readonly requestCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly privacyBlockedCount: number;
  readonly versionMismatchCount: number;
  readonly cancellationCount: number;
  readonly averageLatencyMs: number | null;
  readonly lastEvaluatedAt: UtcInstant;
  readonly exposesPrivatePrompts: false;
};

export class S3mFinanceObservability {
  private requestCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private privacyBlockedCount = 0;
  private versionMismatchCount = 0;
  private cancellationCount = 0;
  private latencyTotalMs = 0;

  recordSuccess(latencyMs: number): void {
    this.requestCount += 1;
    this.successCount += 1;
    this.latencyTotalMs += latencyMs;
  }

  recordFailure(kind: 'GENERAL' | 'PRIVACY_BLOCKED' | 'VERSION_MISMATCH' | 'CANCELLED'): void {
    this.requestCount += 1;
    this.failureCount += 1;
    if (kind === 'PRIVACY_BLOCKED') {
      this.privacyBlockedCount += 1;
    }
    if (kind === 'VERSION_MISMATCH') {
      this.versionMismatchCount += 1;
    }
    if (kind === 'CANCELLED') {
      this.cancellationCount += 1;
    }
  }

  snapshot(profile: S3mFinanceModelProfile, now: UtcInstant): S3mFinanceObservabilitySnapshot {
    const averageLatencyMs =
      this.successCount > 0 ? Math.round(this.latencyTotalMs / this.successCount) : null;
    return Object.freeze({
      deploymentHealth: profile.healthState,
      qualificationState: profile.qualificationState,
      modelVersion: profile.modelVersion,
      deploymentId: profile.deploymentId,
      requestCount: this.requestCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      privacyBlockedCount: this.privacyBlockedCount,
      versionMismatchCount: this.versionMismatchCount,
      cancellationCount: this.cancellationCount,
      averageLatencyMs,
      lastEvaluatedAt: now,
      exposesPrivatePrompts: false,
    });
  }
}
