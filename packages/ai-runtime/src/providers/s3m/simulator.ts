import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { S3mTransport } from './transport.ts';
import { s3mNativeFixture } from './fixtures.ts';
import type {
  S3mEndpointContract,
  S3mHealthProbe,
  S3mNativeRequest,
  S3mSimulatorFixture,
  S3mTransportResult,
} from './types.ts';

export type SimulatedS3mServerOptions = {
  readonly healthy?: boolean;
  readonly defaultFixture?: S3mSimulatorFixture;
  readonly timeoutAfterAttempts?: number;
};

/**
 * In-process deterministic S3M simulator. Tests and the local demo use
 * this instead of a real S3M server or network.
 */
export class SimulatedS3mServer implements S3mTransport {
  readonly kind = 'S3M_TRANSPORT' as const;
  private healthy: boolean;
  private readonly defaultFixture: S3mSimulatorFixture;
  private readonly timeoutAfterAttempts: number | null;
  private attempts = 0;
  readonly observedInferencePaths: string[] = [];
  readonly observedHealthPaths: string[] = [];

  constructor(options: SimulatedS3mServerOptions = {}) {
    this.healthy = options.healthy ?? true;
    this.defaultFixture = options.defaultFixture ?? 'grow_my_money';
    this.timeoutAfterAttempts = options.timeoutAfterAttempts ?? null;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  infer(request: S3mNativeRequest, endpoints: S3mEndpointContract): S3mTransportResult {
    this.observedInferencePaths.push(endpoints.inferencePath);
    this.attempts += 1;
    if (!this.healthy) {
      return Object.freeze({
        ok: false,
        code: 'UNAVAILABLE',
        detail: 'S3M simulator is marked unavailable',
        correlationId: request.correlationId,
        retryable: true,
      });
    }
    const fixture = request.fixture ?? this.defaultFixture;
    if (fixture === 'timeout' || (this.timeoutAfterAttempts !== null && this.attempts <= this.timeoutAfterAttempts)) {
      return Object.freeze({
        ok: false,
        code: 'TIMEOUT',
        detail: 'S3M simulator timeout',
        correlationId: request.correlationId,
        retryable: true,
      });
    }
    if (fixture === 'unavailable') {
      return Object.freeze({
        ok: false,
        code: 'UNAVAILABLE',
        detail: 'S3M simulator unavailable fixture',
        correlationId: request.correlationId,
        retryable: true,
      });
    }
    if (fixture === 'retry_then_ok' && this.attempts === 1) {
      return Object.freeze({
        ok: false,
        code: 'TIMEOUT',
        detail: 'S3M simulator first-attempt timeout',
        correlationId: request.correlationId,
        retryable: true,
      });
    }
    return Object.freeze({
      ok: true,
      value: s3mNativeFixture(fixture === 'retry_then_ok' ? 'grow_my_money' : fixture, request.correlationId, request.modelId, request.modelVersion),
    });
  }

  health(now: UtcInstant, endpoints: S3mEndpointContract): S3mHealthProbe {
    this.observedHealthPaths.push(endpoints.healthPath);
    return Object.freeze({
      healthy: this.healthy,
      reason: this.healthy ? null : 'S3M simulator health probe failed',
      checkedAt: now,
    });
  }
}
