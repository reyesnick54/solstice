export const PROVIDER_SDK_ERROR_CODES = [
  'PROVIDER_NOT_FOUND',
  'PROVIDER_ALREADY_REGISTERED',
  'PROVIDER_NOT_IN_CATALOG',
  'PROVIDER_BLOCKED',
  'PROVIDER_METADATA_INVALID',
  'PROVIDER_ACTIVATION_DENIED',
  'PROVIDER_LIFECYCLE_ERROR',
  'PROVIDER_SECRET_EXPOSURE_FORBIDDEN',
] as const;

export type ProviderSdkErrorCode = (typeof PROVIDER_SDK_ERROR_CODES)[number];

export type ProviderSdkError = {
  readonly code: ProviderSdkErrorCode;
  readonly message: string;
  readonly providerId?: string;
};

export function providerSdkError(
  code: ProviderSdkErrorCode,
  message: string,
  providerId?: string,
): ProviderSdkError {
  return Object.freeze({
    code,
    message,
    ...(providerId ? { providerId } : {}),
  });
}

export class ProviderSdkException extends Error {
  readonly code: ProviderSdkErrorCode;
  readonly providerId?: string;

  constructor(error: ProviderSdkError) {
    super(error.message);
    this.name = 'ProviderSdkException';
    this.code = error.code;
    if (error.providerId) {
      this.providerId = error.providerId;
    }
  }
}

export function throwProviderSdk(error: ProviderSdkError): never {
  throw new ProviderSdkException(error);
}
