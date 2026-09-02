export {
  AUTHORIZATION_ACTOR_TYPES,
  ADMIN_ACTOR_TYPES,
  DELEGATABLE_ACTOR_TYPES,
  GOVERNANCE_ACTOR_TYPES,
  NON_DELEGATABLE_AUTHORITY,
  VALIDATOR_ACTOR_TYPES,
  actorMayHoldAdminAuthority,
  actorMayHoldGovernanceAuthority,
  actorMayHoldValidatorAuthority,
  authorityIsNonDelegatable,
  isAuthorizationActorType,
  type AuthorizationActorType,
  type NonDelegatableAuthority,
} from './actor-types.ts';

export {
  IdentityLinkRegistry,
  authenticationChangePreservesEconomicIdentity,
  type AuthenticationIdentity,
  type GovernanceIdentity,
  type HumanEconomicIdentity,
  type IdentityLink,
  type IdentityLinkKind,
  type SeparatedIdentity,
  type ValidatorIdentity,
  type WalletIdentity,
} from './identity-separation.ts';

export {
  CANONICAL_RELATIONSHIPS,
  PERMISSION_VERBS,
  RELATIONSHIP_TYPES,
  RESOURCE_TYPES,
  findCanonicalRelationship,
  parseTupleKey,
  tupleKey,
  verbPermittedForRelationship,
  type PermissionVerb,
  type RelationshipTuple,
  type RelationshipType,
  type ResourceType,
} from './relationship-model.ts';

export {
  DELEGATION_DENIAL_CODES,
  DELEGATION_STATUSES,
  createDelegationRecord,
  delegationStatus,
  evaluateDelegation,
  revokeDelegation,
  type DelegationCheck,
  type DelegationDecision,
  type DelegationDenialCode,
  type DelegationRecord,
  type DelegationScope,
  type DelegationStatus,
} from './delegation.ts';

export {
  AUTHORIZATION_DECISION_CODES,
  isOpenFgaAdapter,
  type AuthorizationCheck,
  type AuthorizationDecision,
  type AuthorizationDecisionCode,
  type AuthorizationResource,
  type AuthorizationSubject,
  type FineGrainedAuthorization,
  type OpenFgaAdapterConfig,
  type OpenFgaAuthorizationAdapter,
} from './interface.ts';

export {
  SimulationRelationshipEngine,
  assertOwnResource,
  createSimulationRelationshipEngine,
} from './engine.ts';

export {
  ADMIN_ACTION_REQUIREMENTS,
  SENSITIVE_ADMIN_ACTIONS,
  evaluateAdminAuthorization,
  evaluateServiceAuthorization,
  governanceCannotBypassTransactionRules,
  validatorCannotBecomeGovernanceActor,
  type AdminAuthorizationCheck,
  type AdminAuthorizationDecision,
  type SensitiveAdminAction,
  type ServiceAuthorizationCheck,
  type ServiceAuthorizationDecision,
} from './admin-and-service.ts';

export {
  KEYCLOAK_INTEGRATION_DECISION,
  OPENFGA_INTEGRATION_DECISION,
  SimulationIdentityFederation,
  type FederatedAuthenticationResult,
  type IdentityFederationPort,
  type IdentityFederationProvider,
  type OidcTokenClaims,
} from './federation.ts';
