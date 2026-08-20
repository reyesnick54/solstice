/**
 * Transport-level authentication for the off-chain connector runtime.
 *
 * Credentials remain behind SecretProvider / SecretReference. Tokens,
 * API keys, and private certificate material are never written to
 * logs, exceptions, metrics, provenance, or observations.
 */

import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { hmacSha256Hex } from '../../../../security/src/hmac.ts';
import type { SecretProvider, SecretReference } from '../../../../security/src/secrets.ts';
import { resolveAssignedCredential } from './credentials.ts';
import type { AuthenticationMethod, OracleWorkloadIdentity, ProductionOracleRejection } from './types.ts';
import type {
  ConnectorAuthConfig,
  ConnectorClock,
  ConnectorHttpMethod,
  ExternalHttpTransport,
  OauthClientConfig,
  ProviderEndpointProfile,
  SignedRequestConfig,
} from './runtime-types.ts';
import { headerValue } from './transport.ts';
import { approveEndpointProfile, destinationMatchesProfile, enforceSsrfPolicy, enforceTlsPolicy, parseDestination } from './security-policy.ts';

export type PreparedConnectorRequest = {
  readonly method: ConnectorHttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string | undefined;
  readonly clientCertificatePresent: boolean;
};

type CachedOauthToken = {
  readonly accessToken: string;
  readonly expiresAtUnix: bigint;
};

export class OauthTokenCache {
  private readonly tokens = new Map<string, CachedOauthToken>();

  get(key: string, nowUnix: bigint): string | undefined {
    const row = this.tokens.get(key);
    if (!row || nowUnix >= row.expiresAtUnix) {
      return undefined;
    }
    return row.accessToken;
  }

  put(key: string, accessToken: string, expiresAtUnix: bigint): void {
    this.tokens.set(key, { accessToken, expiresAtUnix });
  }
}

export async function prepareAuthenticatedRequest(input: {
  readonly method: ConnectorHttpMethod;
  readonly url: string;
  readonly body: string | undefined;
  readonly sourceId: string;
  readonly identity: OracleWorkloadIdentity;
  readonly authenticationClass: AuthenticationMethod;
  readonly profile: ProviderEndpointProfile;
  readonly auth: ConnectorAuthConfig;
  readonly secrets: SecretProvider;
  readonly transport: ExternalHttpTransport;
  readonly clock: ConnectorClock;
  readonly oauthCache: OauthTokenCache;
  readonly nowUnix: bigint;
}): Promise<Result<PreparedConnectorRequest, ProductionOracleRejection>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  let clientCertificatePresent = false;

  switch (input.authenticationClass) {
    case 'FILE_FIXTURE_TEST_ONLY':
      break;
    case 'API_KEY_REFERENCE': {
      const secret = resolveAssignedCredential(input.identity, input.sourceId, input.secrets, input.nowUnix);
      if (!secret.ok) {
        return secret;
      }
      const config = input.auth.apiKey ?? { headerName: 'x-api-key', valuePrefix: '' };
      headers[config.headerName.toLowerCase()] = `${config.valuePrefix}${secret.value.revealUtf8()}`;
      break;
    }
    case 'OAUTH_CLIENT': {
      if (!input.auth.oauth) {
        return err({ code: 'OAUTH_TOKEN_FAILED', detail: 'OAuth client configuration is required' });
      }
      const token = await acquireOauthToken({
        config: input.auth.oauth,
        secrets: input.secrets,
        transport: input.transport,
        cache: input.oauthCache,
        nowUnix: input.nowUnix,
        cacheKey: `${input.identity.collectorId}:${input.sourceId}`,
      });
      if (!token.ok) {
        return token;
      }
      headers.authorization = `Bearer ${token.value}`;
      break;
    }
    case 'SIGNED_REQUEST': {
      if (!input.auth.signedRequest) {
        return err({ code: 'SIGNATURE_PROFILE_INVALID', detail: 'signed-request profile is required' });
      }
      const signed = signConnectorRequest({
        method: input.method,
        url: input.url,
        body: input.body ?? '',
        profile: input.auth.signedRequest,
        secrets: input.secrets,
        clock: input.clock,
      });
      if (!signed.ok) {
        return signed;
      }
      Object.assign(headers, signed.value);
      break;
    }
    case 'MTLS': {
      const material = resolveMtlsMaterial(input.auth, input.secrets);
      if (!material.ok) {
        return material;
      }
      clientCertificatePresent = true;
      break;
    }
    case 'PRIVATE_NETWORK': {
      const assigned = resolveAssignedCredential(input.identity, input.sourceId, input.secrets, input.nowUnix);
      if (!assigned.ok) {
        return assigned;
      }
      break;
    }
    default: {
      const exhaustive: never = input.authenticationClass;
      return err({ code: 'AUTH_FAILED', detail: `unsupported authentication class ${String(exhaustive)}` });
    }
  }

  if (input.authenticationClass !== input.profile.authenticationClass && input.authenticationClass !== 'FILE_FIXTURE_TEST_ONLY') {
    return err({
      code: 'AUTH_FAILED',
      detail: 'authentication class does not match the approved endpoint profile',
    });
  }

  return ok(
    Object.freeze({
      method: input.method,
      url: input.url,
      headers: Object.freeze(headers),
      body: input.body,
      clientCertificatePresent,
    }),
  );
}

export async function acquireOauthToken(input: {
  readonly config: OauthClientConfig;
  readonly secrets: SecretProvider;
  readonly transport: ExternalHttpTransport;
  readonly cache: OauthTokenCache;
  readonly nowUnix: bigint;
  readonly cacheKey: string;
}): Promise<Result<string, ProductionOracleRejection>> {
  const cached = input.cache.get(input.cacheKey, input.nowUnix);
  if (cached) {
    return ok(cached);
  }
  const tokenUrl = profileUrl(input.config.tokenEndpointProfile);
  const destination = parseDestination(tokenUrl);
  if (!destination.ok) {
    return destination;
  }
  const approved = approveEndpointProfile(
    input.config.tokenEndpointProfile,
    input.config.tokenEndpointProfile.sourceId,
    input.config.tokenEndpointProfile.providerId,
  );
  if (!approved.ok) {
    return approved;
  }
  const matched = destinationMatchesProfile(destination.value, input.config.tokenEndpointProfile);
  if (!matched.ok) {
    return matched;
  }
  const ssrf = enforceSsrfPolicy(destination.value, input.config.tokenEndpointProfile, 'FIXTURE');
  if (!ssrf.ok) {
    return ssrf;
  }
  const tls = enforceTlsPolicy(destination.value, input.config.tokenEndpointProfile);
  if (!tls.ok) {
    return tls;
  }
  const clientId = resolveSecret(input.secrets, input.config.clientIdRef);
  const clientSecret = resolveSecret(input.secrets, input.config.clientSecretRef);
  if (!clientId.ok) {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: 'OAuth client ID reference is unresolved' });
  }
  if (!clientSecret.ok) {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: 'OAuth client secret reference is unresolved' });
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId.value,
    client_secret: clientSecret.value,
    scope: input.config.scope,
    ...(input.config.audience ? { audience: input.config.audience } : {}),
  }).toString();
  const response = await input.transport.request({
    method: 'POST',
    url: tokenUrl,
    headers: Object.freeze({
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body,
    timeoutMs: input.config.tokenEndpointProfile.timeoutMs,
    maximumResponseBytes: input.config.tokenEndpointProfile.maximumResponseBytes,
    tls: { rejectUnauthorized: true, clientCertificatePresent: false },
  });
  if (!response.ok) {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: response.error.detail });
  }
  if (response.value.status !== 200) {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: `token endpoint rejected the client credentials` });
  }
  let parsed: { access_token?: unknown; expires_in?: unknown };
  try {
    parsed = JSON.parse(response.value.body) as { access_token?: unknown; expires_in?: unknown };
  } catch {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: 'token endpoint returned non-JSON' });
  }
  if (typeof parsed.access_token !== 'string' || parsed.access_token.length === 0) {
    return err({ code: 'OAUTH_TOKEN_FAILED', detail: 'token endpoint omitted access_token' });
  }
  const expiresIn = typeof parsed.expires_in === 'number' && Number.isInteger(parsed.expires_in) ? parsed.expires_in : 300;
  input.cache.put(input.cacheKey, parsed.access_token, input.nowUnix + BigInt(Math.max(1, expiresIn - 5)));
  return ok(parsed.access_token);
}

export function signConnectorRequest(input: {
  readonly method: ConnectorHttpMethod;
  readonly url: string;
  readonly body: string;
  readonly profile: SignedRequestConfig;
  readonly secrets: SecretProvider;
  readonly clock: ConnectorClock;
}): Result<Readonly<Record<string, string>>, ProductionOracleRejection> {
  if (input.profile.algorithm !== 'HMAC-SHA256') {
    return err({ code: 'SIGNATURE_PROFILE_INVALID', detail: 'only HMAC-SHA256 is registered for connector signatures' });
  }
  const key = resolveSecret(input.secrets, input.profile.keyRef);
  if (!key.ok) {
    return err({ code: 'SIGNATURE_PROFILE_INVALID', detail: 'signed-request key reference is unresolved' });
  }
  const timestamp = input.clock.nowUnix().toString();
  const nonce = createHash('sha256')
    .update(`sunrey.connector.nonce:${timestamp}:${input.clock.nowMs().toString()}`)
    .digest('hex')
    .slice(0, 32);
  const path = new URL(input.url).pathname;
  const bodyHash = createHash('sha256').update(input.body).digest('hex');
  const canonical = `${input.method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = hmacSha256Hex(key.value, canonical);
  return ok(
    Object.freeze({
      [input.profile.headerName.toLowerCase()]: signature,
      [input.profile.timestampHeader.toLowerCase()]: timestamp,
      [input.profile.nonceHeader.toLowerCase()]: nonce,
    }),
  );
}

export function canonicalSignedRequest(input: {
  readonly method: ConnectorHttpMethod;
  readonly path: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly body: string;
}): string {
  const bodyHash = createHash('sha256').update(input.body).digest('hex');
  return `${input.method}\n${input.path}\n${input.timestamp}\n${input.nonce}\n${bodyHash}`;
}

function resolveMtlsMaterial(
  auth: ConnectorAuthConfig,
  secrets: SecretProvider,
): Result<true, ProductionOracleRejection> {
  if (!auth.mtls) {
    return err({ code: 'AUTH_FAILED', detail: 'mTLS certificate references are required' });
  }
  const certificate = secrets.resolve(auth.mtls.certificateRef);
  const privateKey = secrets.resolve(auth.mtls.privateKeyRef);
  if (!certificate.ok || !privateKey.ok) {
    return err({ code: 'AUTH_FAILED', detail: 'mTLS SecretReference could not be resolved' });
  }
  if (certificate.value.revealUtf8().length === 0 || privateKey.value.revealUtf8().length === 0) {
    return err({ code: 'AUTH_FAILED', detail: 'mTLS material is empty' });
  }
  return ok(true);
}

function resolveSecret(secrets: SecretProvider, reference: SecretReference): Result<string, ProductionOracleRejection> {
  const resolved = secrets.resolve(reference);
  if (!resolved.ok) {
    return err({ code: 'CREDENTIAL_NOT_ASSIGNED', detail: resolved.error.message });
  }
  return ok(resolved.value.revealUtf8());
}

export function profileUrl(profile: ProviderEndpointProfile, suffix = ''): string {
  const path = `${profile.pathPrefix}${suffix}`;
  return `${profile.scheme}://${profile.hostname}:${profile.port}${path}`;
}

export function requestHeadersAreSafeToLog(headers: Readonly<Record<string, string>>): boolean {
  const forbidden = ['authorization', 'x-api-key', 'x-signature', 'x-sunrey-signature'];
  for (const name of forbidden) {
    const value = headerValue(headers, name);
    if (value && value.length > 0 && !value.startsWith('[REDACTED]')) {
      return false;
    }
  }
  return true;
}
