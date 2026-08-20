import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import {
  candidateRejection,
  type ExternalProviderEndpointProfile,
  type ExternalProviderRequestBlueprint,
  type ProviderCandidateRejection,
} from './types.ts';

const SECRET_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-api-token',
  'cookie',
]);

const SECRET_VALUE = /api[_-]?key|client_secret|bearer\s+|-----BEGIN|oauth_token|access_token/i;

export function createRequestBlueprint(
  input: ExternalProviderRequestBlueprint,
): Result<ExternalProviderRequestBlueprint, ProviderCandidateRejection> {
  if (input.providerId.length === 0 || input.feedId.length === 0 || input.endpointProfileId.length === 0) {
    return err(candidateRejection('ARBITRARY_URL_FORBIDDEN', 'requests must reference endpointProfileId'));
  }
  if (input.pathTemplate.includes('://') || input.pathTemplate.includes('@')) {
    return err(candidateRejection('ARBITRARY_URL_FORBIDDEN', 'path templates cannot contain a hostname'));
  }
  for (const name of input.approvedHeaderNames) {
    if (SECRET_HEADER_NAMES.has(name.toLowerCase())) {
      return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', `${name} cannot be persisted on a request blueprint`));
    }
  }
  const encoded = JSON.stringify(input);
  if (SECRET_VALUE.test(encoded)) {
    return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', 'request blueprints must not contain secret values'));
  }
  return ok(Object.freeze({ ...input }));
}

export function materializeApprovedUrl(input: {
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly blueprint: ExternalProviderRequestBlueprint;
  readonly pathParameters?: Readonly<Record<string, string>>;
}): Result<string, ProviderCandidateRejection> {
  if (input.blueprint.endpointProfileId !== input.endpoint.endpointProfileId) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', 'blueprint endpointProfileId does not match the approved profile'));
  }
  if (input.blueprint.providerId !== input.endpoint.providerId) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', 'blueprint provider does not match the endpoint profile'));
  }
  if (!input.endpoint.allowedMethods.includes(input.blueprint.method)) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', `method ${input.blueprint.method} is not allowed`));
  }
  let path = input.blueprint.pathTemplate;
  for (const [key, value] of Object.entries(input.pathParameters ?? {})) {
    if (value.includes('/') || value.includes('..') || value.includes(':') || value.includes('@')) {
      return err(candidateRejection('ARBITRARY_URL_FORBIDDEN', `unsafe path parameter ${key}`));
    }
    path = path.replaceAll(`{${key}}`, encodeURIComponent(value));
  }
  if (path.includes('{')) {
    return err(candidateRejection('ARBITRARY_URL_FORBIDDEN', 'unresolved path template tokens remain'));
  }
  const allowed = input.endpoint.allowedPathPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));
  if (!allowed) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', `path ${path} is outside allowed prefixes`));
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input.blueprint.queryTemplate)) {
    if (!input.endpoint.allowedQueryParameters.includes(key)) {
      return err(candidateRejection('ENDPOINT_NOT_APPROVED', `query parameter ${key} is not allowed`));
    }
    if (SECRET_VALUE.test(value)) {
      return err(candidateRejection('CREDENTIAL_IN_URL', 'credentials cannot appear in query parameters'));
    }
    query.set(key, value);
  }
  const origin = input.endpoint.baseOrigin.replace(/\/$/, '');
  const qs = query.toString();
  return ok(qs.length > 0 ? `${origin}${path}?${qs}` : `${origin}${path}`);
}

export function assertNoSecretsInBlueprint(blueprint: ExternalProviderRequestBlueprint): Result<true, ProviderCandidateRejection> {
  const created = createRequestBlueprint(blueprint);
  return created.ok ? ok(true) : created;
}
