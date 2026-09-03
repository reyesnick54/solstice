// @ts-nocheck
/**
 * Provider authentication strategies and secret-backed injection.
 *
 * Adapters declare auth strategy; secrets resolve at the transport boundary.
 */

import type { SecretProvider, SecretReference } from '../../security/src/secrets.ts';
import type { ProviderTransportError } from './errors.ts';
import { securityError } from './errors.ts';

export type ProviderAuthStrategy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'api_key_header';
      readonly headerName: string;
      readonly secretRef: SecretReference;
      readonly prefix?: string | undefined;
    }
  | {
      readonly kind: 'api_key_query';
      readonly paramName: string;
      readonly secretRef: SecretReference;
    }
  | {
      readonly kind: 'bearer';
      readonly secretRef: SecretReference;
      readonly prefix?: string | undefined;
    }
  | {
      readonly kind: 'basic';
      readonly usernameRef: SecretReference;
      readonly passwordRef: SecretReference;
    }
  | {
      readonly kind: 'custom_header';
      readonly headerName: string;
      readonly secretRef: SecretReference;
      readonly prefix?: string | undefined;
    }
  | {
      readonly kind: 'oauth_access_token';
      readonly resolveToken: () => Promise<string>;
    };

export type ProviderAuthInjection = {
  readonly headers: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
};

export type ProviderAuthResolver = {
  readonly resolverId: string;
  resolve(
    strategy: ProviderAuthStrategy,
    context: { readonly providerId: string; readonly requestId: string },
  ): Promise<ProviderAuthInjection | ProviderTransportError>;
};

export type SecretBackedAuthResolverOptions = {
  readonly resolverId?: string | undefined;
  readonly secrets: SecretProvider;
};

export class SecretBackedProviderAuthResolver implements ProviderAuthResolver {
  readonly resolverId: string;
  private readonly secrets: SecretProvider;

  constructor(options: SecretBackedAuthResolverOptions) {
    this.resolverId = options.resolverId ?? 'provider-sdk.secret-auth';
    this.secrets = options.secrets;
    Object.freeze(this);
  }

  async resolve(
    strategy: ProviderAuthStrategy,
    context: { readonly providerId: string; readonly requestId: string },
  ): Promise<ProviderAuthInjection | ProviderTransportError> {
    switch (strategy.kind) {
      case 'none':
        return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
      case 'api_key_header': {
        const value = this.resolveSecret(strategy.secretRef, context);
        if (!value.ok) {
          return value.error;
        }
        const headerName = strategy.headerName.toLowerCase();
        return Object.freeze({
          headers: Object.freeze({
            [headerName]: `${strategy.prefix ?? ''}${value.value}`,
          }),
          queryParams: Object.freeze({}),
        });
      }
      case 'api_key_query': {
        const value = this.resolveSecret(strategy.secretRef, context);
        if (!value.ok) {
          return value.error;
        }
        return Object.freeze({
          headers: Object.freeze({}),
          queryParams: Object.freeze({ [strategy.paramName]: value.value }),
        });
      }
      case 'bearer': {
        const value = this.resolveSecret(strategy.secretRef, context);
        if (!value.ok) {
          return value.error;
        }
        return Object.freeze({
          headers: Object.freeze({
            authorization: `${strategy.prefix ?? 'Bearer '}${value.value}`,
          }),
          queryParams: Object.freeze({}),
        });
      }
      case 'basic': {
        const username = this.resolveSecret(strategy.usernameRef, context);
        if (!username.ok) {
          return username.error;
        }
        const password = this.resolveSecret(strategy.passwordRef, context);
        if (!password.ok) {
          return password.error;
        }
        const encoded = Buffer.from(`${username.value}:${password.value}`, 'utf8').toString('base64');
        return Object.freeze({
          headers: Object.freeze({ authorization: `Basic ${encoded}` }),
          queryParams: Object.freeze({}),
        });
      }
      case 'custom_header': {
        const value = this.resolveSecret(strategy.secretRef, context);
        if (!value.ok) {
          return value.error;
        }
        const headerName = strategy.headerName.toLowerCase();
        return Object.freeze({
          headers: Object.freeze({
            [headerName]: `${strategy.prefix ?? ''}${value.value}`,
          }),
          queryParams: Object.freeze({}),
        });
      }
      case 'oauth_access_token': {
        try {
          const token = await strategy.resolveToken();
          if (token.length === 0) {
            return securityError(context.providerId, context.requestId, 'OAuth access token hook returned empty token');
          }
          return Object.freeze({
            headers: Object.freeze({ authorization: `Bearer ${token}` }),
            queryParams: Object.freeze({}),
          });
        } catch {
          return securityError(context.providerId, context.requestId, 'OAuth access token hook failed');
        }
      }
      default: {
        const exhaustive: never = strategy;
        return securityError(context.providerId, context.requestId, `unsupported auth strategy ${String(exhaustive)}`);
      }
    }
  }

  private resolveSecret(
    reference: SecretReference,
    context: { readonly providerId: string; readonly requestId: string },
  ):
    | { readonly ok: true; readonly value: string }
    | { readonly ok: false; readonly error: ProviderTransportError } {
    const resolved = this.secrets.resolve(reference);
    if (!resolved.ok) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, resolved.error.message),
      };
    }
    const value = resolved.value.revealUtf8();
    if (value.length === 0) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, 'secret reference resolved to empty value'),
      };
    }
    return { ok: true, value };
  }
}

export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

export function bearerAuthHeader(token: string, prefix = 'Bearer '): string {
  return `${prefix}${token}`;
}

export function unresolvedSecretMessage(reference: SecretReference): string {
  return `secret ${reference.href} is unresolved`;
}

export const NO_AUTH_PROVIDER_RESOLVER: ProviderAuthResolver = Object.freeze({
  resolverId: 'provider-sdk.no-auth',
  async resolve(strategy) {
    if (strategy.kind === 'none') {
      return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
    }
    return securityError('AUTH_UNSUPPORTED', `unsupported auth strategy: ${strategy.kind}`);
  },
});
