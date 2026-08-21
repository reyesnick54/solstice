/**
 * Identity service facade. Canonical types and the IdentityService live in
 * packages/identity. This service is the application owner for identity
 * composition; it does not invent a second identity model.
 */
export {
  IdentityService,
  AuthenticationService,
  SimulatedIdentityAdapter,
  SimulatedWebAuthnRelyingParty,
  SimulatedAuthenticator,
  ActorContextIssuer,
  isVerifiedActorContext,
  actionTypesFromCapabilities,
  dispatchAuthHttp,
  authenticateRequestMiddleware,
  type IdentityAuthorityPort,
  type VerifiedActorContext,
  type ActorContext,
  type IdentityFacts,
  type AuthenticatedRequestContext,
} from '../../../packages/identity/src/index.ts';
