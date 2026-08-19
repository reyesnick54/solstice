import { err, type Result } from '../../../../domain/src/result.ts';
import { redactSecrets } from '../../secrets.ts';
import type { AiFailureCode } from '../../taxonomy.ts';
import type { AiProviderFailure } from '../../types.ts';
import type { S3mTransportFailure, S3mTransportFailureCode } from './types.ts';

const TRANSPORT_TO_FAILURE: Readonly<Record<S3mTransportFailureCode, AiFailureCode>> = Object.freeze({
  TIMEOUT: 'PROVIDER_TIMEOUT',
  UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  UNHEALTHY: 'PROVIDER_UNHEALTHY',
  MALFORMED: 'INVALID_STRUCTURED_OUTPUT',
  REJECTED: 'ROUTING_REFUSED',
});

export function s3mFailure(
  code: AiFailureCode,
  detail: string,
): Result<never, AiProviderFailure> {
  return err({
    ok: false,
    code,
    detail: redactSecrets(detail),
    providerKind: 'S3M',
  });
}

export function classifyS3mTransportFailure(failure: S3mTransportFailure): AiProviderFailure {
  return Object.freeze({
    ok: false,
    code: TRANSPORT_TO_FAILURE[failure.code],
    detail: redactSecrets(failure.detail),
    providerKind: 'S3M',
  });
}

export function isRetryableS3mFailure(failure: S3mTransportFailure): boolean {
  return failure.retryable && (failure.code === 'TIMEOUT' || failure.code === 'UNAVAILABLE');
}

export function remapStructuredFailure(failure: AiProviderFailure): AiProviderFailure {
  return Object.freeze({
    ...failure,
    detail: redactSecrets(failure.detail),
    providerKind: 'S3M',
  });
}
