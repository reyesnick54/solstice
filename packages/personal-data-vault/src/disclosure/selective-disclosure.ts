import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AssertionFailure } from './types.ts';

/**
 * Selective-disclosure boundary. Mature SD-JWT / BBS+ integrations plug in
 * here. SunRey does not implement custom cryptographic protocols.
 */
export const SELECTIVE_DISCLOSURE_CAPABILITY = 'INTERFACE_ONLY' as const;

export type SelectiveDisclosureClaim = {
  readonly claimName: string;
  readonly claimValue: string | number | boolean;
};

export type SelectiveDisclosureRequest = {
  readonly credentialCommitmentHash: string;
  readonly purposeId: string;
  readonly requestedClaims: readonly string[];
};

export type SelectiveDisclosureResponse = {
  readonly disclosedClaims: readonly SelectiveDisclosureClaim[];
  readonly proofEnvelope: string | null;
  readonly rawCredentialIncluded: false;
};

export type SelectiveDisclosureProvider = {
  readonly capability: typeof SELECTIVE_DISCLOSURE_CAPABILITY | 'PARTIAL' | 'IMPLEMENTED';
  disclose(request: SelectiveDisclosureRequest): Promise<Result<SelectiveDisclosureResponse, AssertionFailure>>;
};

export function createUnavailableSelectiveDisclosureProvider(): SelectiveDisclosureProvider {
  return Object.freeze({
    capability: SELECTIVE_DISCLOSURE_CAPABILITY,
    async disclose(request) {
      return err({
        code: 'RAW_DATA_REQUEST_DENIED',
        message: `selective disclosure is not configured; requested claims: ${request.requestedClaims.join(', ')}`,
      });
    },
  });
}

export function validateSelectiveDisclosureResponse(response: SelectiveDisclosureResponse): void {
  if (response.rawCredentialIncluded !== false) {
    throw new Error('selective disclosure response must not include raw credential');
  }
}
