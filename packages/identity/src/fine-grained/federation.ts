/**
 * Identity federation port — OIDC/OAuth/SSO behind existing identity boundaries.
 * Keycloak/Ory integration deferred per ADR-0007; this port preserves anti-corruption.
 */
export type IdentityFederationProvider = 'SIMULATION' | 'KEYCLOAK' | 'ORY_KRATOS';

export type OidcTokenClaims = {
  readonly sub: string;
  readonly iss: string;
  readonly aud: readonly string[];
  readonly exp: number;
  readonly acr?: string;
  readonly amr?: readonly string[];
};

export type FederatedAuthenticationResult =
  | {
      readonly authenticated: true;
      readonly provider: IdentityFederationProvider;
      readonly claims: OidcTokenClaims;
      readonly authenticationIdentityId: string;
    }
  | {
      readonly authenticated: false;
      readonly code: string;
      readonly reason: string;
    };

/**
 * Federation adapter port. Production candidate: Keycloak or Ory Kratos+Hydra per cell.
 * Pseudonymous economic identity is never replaced by login identity.
 */
export interface IdentityFederationPort {
  readonly provider: IdentityFederationProvider;

  validateAccessToken(token: string): FederatedAuthenticationResult;

  exchangeAuthorizationCode?(code: string, redirectUri: string): FederatedAuthenticationResult;
}

export class SimulationIdentityFederation implements IdentityFederationPort {
  readonly provider = 'SIMULATION' as const;

  readonly #tokens = new Map<string, OidcTokenClaims>();

  registerToken(token: string, claims: OidcTokenClaims): void {
    this.#tokens.set(token, Object.freeze({ ...claims }));
  }

  validateAccessToken(token: string): FederatedAuthenticationResult {
    const claims = this.#tokens.get(token);
    if (!claims) {
      return { authenticated: false, code: 'INVALID_TOKEN', reason: 'token not recognized' };
    }
    if (Date.now() >= claims.exp * 1000) {
      return { authenticated: false, code: 'TOKEN_EXPIRED', reason: 'access token expired' };
    }
    return {
      authenticated: true,
      provider: 'SIMULATION',
      claims,
      authenticationIdentityId: `auth:${claims.sub}`,
    };
  }
}

/**
 * Keycloak integration decision: deferred.
 * Rationale (ADR-0007): per-cell OSS IdP behind OIDC-shaped anti-corruption layer.
 * Lead candidate Ory Kratos+Hydra; Keycloak fallback for SAML/workforce federation.
 */
export const KEYCLOAK_INTEGRATION_DECISION = Object.freeze({
  adopted: false,
  rationale: 'Deferred per ADR-0007; integrate behind IdentityFederationPort when cell IdP is provisioned',
  fallbackCandidate: 'KEYCLOAK',
  leadCandidate: 'ORY_KRATOS_HYDRA',
});

/**
 * OpenFGA integration decision: deferred.
 * Rationale: typed relationship engine in simulation; adapter port ready for swap.
 */
export const OPENFGA_INTEGRATION_DECISION = Object.freeze({
  adopted: false,
  rationale: 'Typed SimulationRelationshipEngine adopted; OpenFgaAuthorizationAdapter port defined for future swap',
  tupleFormat: 'subjectType:subjectId#relation@objectType:objectId',
});
