/**
 * Identity service facade. Canonical types and the IdentityService live in
 * packages/identity. This service is the application owner for identity
 * composition; it does not invent a second identity model.
 */
export {
  IdentityService,
  SimulatedIdentityAdapter,
  SimulatedWebAuthnRelyingParty,
  SimulatedAuthenticator,
  ActorContextIssuer,
  isVerifiedActorContext,
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
  type VerifiedActorContext,
  type ActorContext,
  type IdentityFacts,
} from '../../../packages/identity/src/index.ts';
