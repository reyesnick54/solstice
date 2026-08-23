export const BFF_ERROR_CATEGORIES = [
  'VALIDATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'POLICY',
  'NOT_FOUND',
  'TEMPORARY_UNAVAILABLE',
  'INTERNAL',
] as const;
export type BffErrorCategory = (typeof BFF_ERROR_CATEGORIES)[number];

export const BFF_ERROR_CODES = [
  'AUTH_REQUIRED',
  'SESSION_INVALID',
  'RESOURCE_NOT_OWNED',
  'NOT_FOUND',
  'VALIDATION',
  'FORBIDDEN_PROFILE_FIELD',
  'INVALID_PAGINATION_CURSOR',
  'INVALID_FILTER',
  'INVALID_PERIOD',
  'FEATURE_UNAVAILABLE',
  'KERNEL_DENIED',
  'MALFORMED',
  'METHOD_NOT_ALLOWED',
  'STEP_UP_REQUIRED',
  'KERNEL_REFUSED',
] as const;
export type BffErrorCode = (typeof BFF_ERROR_CODES)[number];

export type BffErrorEnvelope = {
  readonly errorCode: BffErrorCode;
  readonly category: BffErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly detailsSafeForClient: Readonly<Record<string, string>>;
  readonly requestId: string;
  readonly apiVersion: 'v1';
};

export function bffError(input: {
  readonly errorCode: BffErrorCode;
  readonly category: BffErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly detailsSafeForClient?: Readonly<Record<string, string>>;
}): BffErrorEnvelope {
  return Object.freeze({
    errorCode: input.errorCode,
    category: input.category,
    message: input.message,
    retryable: input.retryable,
    detailsSafeForClient: Object.freeze({ ...(input.detailsSafeForClient ?? {}) }),
    requestId: input.requestId,
    apiVersion: 'v1',
  });
}

export function statusForError(error: BffErrorEnvelope): number {
  switch (error.errorCode) {
    case 'AUTH_REQUIRED':
    case 'SESSION_INVALID':
      return 401;
    case 'STEP_UP_REQUIRED':
      return error.category === 'AUTHENTICATION' ? 401 : 403;
    case 'RESOURCE_NOT_OWNED':
    case 'FORBIDDEN_PROFILE_FIELD':
    case 'FEATURE_UNAVAILABLE':
    case 'KERNEL_DENIED':
    case 'KERNEL_REFUSED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'METHOD_NOT_ALLOWED':
      return 405;
    case 'VALIDATION':
    case 'INVALID_PAGINATION_CURSOR':
    case 'INVALID_FILTER':
    case 'INVALID_PERIOD':
    case 'MALFORMED':
      return 400;
    default:
      return 400;
  }
}

export function isBffError(value: unknown): value is BffErrorEnvelope {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'errorCode' in value &&
      'category' in value &&
      'requestId' in value &&
      'apiVersion' in value,
  );
}
