import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  S3mEndpointContract,
  S3mHealthProbe,
  S3mNativeRequest,
  S3mTransportResult,
} from './types.ts';

/**
 * Bounded S3M transport port. The real proprietary engine is a separate
 * system. SunRey talks to it only through this contract. Endpoint paths
 * are supplied by configuration; this file does not invent remote routes
 * and does not perform network I/O.
 */
export type S3mTransport = {
  readonly kind: 'S3M_TRANSPORT';
  infer(request: S3mNativeRequest, endpoints: S3mEndpointContract): S3mTransportResult;
  health(now: UtcInstant, endpoints: S3mEndpointContract): S3mHealthProbe;
};

export type ConfigurableS3mTransportOptions = {
  readonly infer: S3mTransport['infer'];
  readonly health?: S3mTransport['health'];
};

/**
 * Injected transport that honors the configured endpoint contract without
 * hard-coding a remote path. Tests and the local simulator supply the
 * actual behavior.
 */
export class ConfigurableS3mTransport implements S3mTransport {
  readonly kind = 'S3M_TRANSPORT' as const;
  private readonly inferImpl: S3mTransport['infer'];
  private readonly healthImpl: S3mTransport['health'];

  constructor(options: ConfigurableS3mTransportOptions) {
    this.inferImpl = options.infer;
    this.healthImpl =
      options.health ??
      ((now) =>
        Object.freeze({
          healthy: true,
          reason: null,
          checkedAt: now,
        }));
  }

  infer(request: S3mNativeRequest, endpoints: S3mEndpointContract): S3mTransportResult {
    return this.inferImpl(request, endpoints);
  }

  health(now: UtcInstant, endpoints: S3mEndpointContract): S3mHealthProbe {
    return this.healthImpl(now, endpoints);
  }
}
