/**
 * Provider-neutral OracleSourceAdapter.
 *
 * Adapters run off-chain. Consensus execution never imports an adapter
 * for HTTP. Credential values are never stored on the feed definition.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { SecretProvider } from '../../../../security/src/secrets.ts';
import type { AuthenticationMethod, EconomicDataSource, OracleWorkloadIdentity, ProductionOracleRejection } from './types.ts';
import { resolveAssignedCredential } from './credentials.ts';
import type { ExternalSourceRecord } from './schema.ts';

export type SourceFetchRequest = {
  readonly source: EconomicDataSource;
  readonly identity: OracleWorkloadIdentity;
  readonly nowUnix: bigint;
};

export type OracleSourceAdapter = {
  readonly adapterId: string;
  readonly authenticationClass: AuthenticationMethod;
  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection>;
};

export function authenticateSource(
  request: SourceFetchRequest,
  secrets: SecretProvider,
): Result<true, ProductionOracleRejection> {
  if (request.source.authenticationMethod === 'FILE_FIXTURE_TEST_ONLY') {
    return ok(true);
  }
  const credential = resolveAssignedCredential(request.identity, request.source.sourceId, secrets, request.nowUnix);
  if (!credential.ok) {
    return err({ code: 'AUTH_FAILED', detail: credential.error.detail });
  }
  const token = credential.value.reveal().toString('utf8');
  if (token.length === 0) {
    return err({ code: 'AUTH_FAILED', detail: 'empty credential' });
  }
  return ok(true);
}

export class MtlsSourceAdapter implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.mtls';
  readonly authenticationClass = 'MTLS' as const;

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    const auth = authenticateSource(request, secrets);
    if (!auth.ok) {
      return auth;
    }
    return err({
      code: 'AUTH_FAILED',
      detail: 'mTLS adapter is an interface only; live provider endpoints are not contacted',
    });
  }
}

export class ApiKeyReferenceAdapter implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.api-key';
  readonly authenticationClass = 'API_KEY_REFERENCE' as const;

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    const auth = authenticateSource(request, secrets);
    if (!auth.ok) {
      return auth;
    }
    return err({
      code: 'AUTH_FAILED',
      detail: 'API key adapter is an interface only; live provider endpoints are not contacted',
    });
  }
}

export class OauthClientAdapter implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.oauth';
  readonly authenticationClass = 'OAUTH_CLIENT' as const;

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    const auth = authenticateSource(request, secrets);
    if (!auth.ok) {
      return auth;
    }
    return err({
      code: 'AUTH_FAILED',
      detail: 'OAuth adapter is an interface only; live provider endpoints are not contacted',
    });
  }
}

export class SignedRequestAdapter implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.signed-request';
  readonly authenticationClass = 'SIGNED_REQUEST' as const;

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    const auth = authenticateSource(request, secrets);
    if (!auth.ok) {
      return auth;
    }
    return err({
      code: 'AUTH_FAILED',
      detail: 'signed-request adapter is an interface only; live provider endpoints are not contacted',
    });
  }
}

export class PrivateNetworkAdapter implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.private-network';
  readonly authenticationClass = 'PRIVATE_NETWORK' as const;

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    const auth = authenticateSource(request, secrets);
    if (!auth.ok) {
      return auth;
    }
    return err({
      code: 'AUTH_FAILED',
      detail: 'private-network adapter is an interface only; live provider endpoints are not contacted',
    });
  }
}

export function adapterFor(method: AuthenticationMethod): OracleSourceAdapter {
  switch (method) {
    case 'MTLS':
      return new MtlsSourceAdapter();
    case 'API_KEY_REFERENCE':
      return new ApiKeyReferenceAdapter();
    case 'OAUTH_CLIENT':
      return new OauthClientAdapter();
    case 'SIGNED_REQUEST':
      return new SignedRequestAdapter();
    case 'PRIVATE_NETWORK':
      return new PrivateNetworkAdapter();
    case 'FILE_FIXTURE_TEST_ONLY':
      throw new TypeError('FILE_FIXTURE_TEST_ONLY uses LocalProviderSimulator');
    default: {
      const exhaustive: never = method;
      throw new TypeError(`unsupported authentication class ${String(exhaustive)}`);
    }
  }
}
