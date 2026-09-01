/**
 * Machine-readable Access Economy ownership map (Wave 2 Prompt 5).
 *
 * Single source of truth for "which package owns this Access concept?"
 * Architecture tests import this module; human docs mirror it in
 * docs/architecture/ACCESS_FABRIC_CANONICALIZATION.md.
 */

export type AccessConceptOwner = Readonly<{
  readonly owner: string;
  readonly canonicalPath: string;
  readonly layer: 'domain' | 'engine' | 'chain' | 'exchange' | 'consumer' | 'agent' | 'simulation';
  readonly notes?: string;
}>;

export type DuplicateTypeClassification =
  | 'canonical'
  | 'transport-dto'
  | 'persistence'
  | 'adapter'
  | 'compatibility'
  | 'accidental';

export type NamedDuplicateType = Readonly<{
  readonly typeName: string;
  readonly owner: string;
  readonly classification: DuplicateTypeClassification;
  readonly alsoDefinedIn?: readonly string[];
}>;

/** Core domain concepts mapped to their authoritative owner package. */
export const ACCESS_CONCEPT_OWNERSHIP = Object.freeze({
  accessRequest: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/types.ts',
    layer: 'domain',
    notes: 'Governed AccessIntent / registry intent; simulation AccessRequest lives in sunrey-economics.',
  },
  accessIntent: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/types.ts',
    layer: 'domain',
    notes: 'Agent proposal and consumer product intents are bounded-context projections.',
  },
  eligibility: {
    owner: 'packages/access-fabric',
    canonicalPath: 'packages/access-fabric/src/engine.ts',
    layer: 'engine',
    notes: 'AccessEntitlementEngine + policy ports; not legal eligibility truth.',
  },
  entitlement: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/types.ts',
    layer: 'domain',
    notes: 'Registry record; operational grant shape in access-fabric is an engine adapter.',
  },
  policy: {
    owner: 'packages/access-fabric',
    canonicalPath: 'packages/access-fabric/src/policy.ts',
    layer: 'engine',
    notes: 'Access domain policy eligibility; Compliance Kernel owns consequential authorization.',
  },
  capability: {
    owner: 'packages/sunrey-access-fabric',
    canonicalPath: 'packages/sunrey-access-fabric/src/productive-capacity/port.ts',
    layer: 'engine',
    notes: 'Productive-capacity discovery; identity CapabilityGrant is orthogonal OAuth scope.',
  },
  allocation: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/dual-token-allocation/engine.ts',
    layer: 'domain',
    notes: 'Epoch/TWAB/dual-token allocation; scarcity mechanism selection in sunrey-access.',
  },
  resourceAvailability: {
    owner: 'packages/access-fabric',
    canonicalPath: 'packages/access-fabric/src/capacity-source.ts',
    layer: 'engine',
    notes: 'Capacity pools and reservation holds; productive truth from sunrey-access-fabric port.',
  },
  pricingValue: {
    owner: 'packages/sunrey-access',
    canonicalPath: 'packages/sunrey-access/src/scarcity/engine.ts',
    layer: 'engine',
    notes: 'Scarcity bands and quote methodology; not Exchange price or mint valuation.',
  },
  sunReyAllocation: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/dual-token-allocation/engine.ts',
    layer: 'domain',
  },
  moonReyAllocation: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/dual-token-allocation/engine.ts',
    layer: 'domain',
  },
  settlement: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/settlement/orchestrator.ts',
    layer: 'domain',
    notes: 'Access settlement orchestration; fiat journal posting via payments/ledger ports.',
  },
  ledgerEvent: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/funding-solvency/entitlement-ledger.ts',
    layer: 'domain',
    notes: 'Access entitlement subledger only; canonical financial ledger is packages/ledger.',
  },
  accessIdentity: {
    owner: 'packages/identity',
    canonicalPath: 'packages/identity/src/capability.ts',
    layer: 'domain',
    notes: 'SubjectRef / ActorContext; Access never owns identity truth.',
  },
  hinAttribution: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/hin-access/contract.ts',
    layer: 'domain',
    notes: 'Bridge orchestration; HIN opportunity/consent owned by information-market.',
  },
  providerFulfillment: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/providers/redemption/types.ts',
    layer: 'domain',
    notes: 'Provider gateway and redemption; chain workflow adapter at sunrey-chain/access-fabric.',
  },
  authorization: {
    owner: 'packages/kernel',
    canonicalPath: 'packages/kernel/src/kernel.ts',
    layer: 'domain',
    notes: 'Compliance Kernel + Execution Authority for consequential state.',
  },
  expiration: {
    owner: 'packages/access-fabric',
    canonicalPath: 'packages/access-fabric/src/lifecycle.ts',
    layer: 'engine',
    notes: 'Reservation and entitlement TTL; chain expiry evidence at sunrey-chain/access.',
  },
  revocation: {
    owner: 'packages/access-economy',
    canonicalPath: 'packages/access-economy/src/lifecycle.ts',
    layer: 'domain',
    notes: 'Registry lifecycle transitions; chain revocation commitments at sunrey-chain/access.',
  },
  auditTrail: {
    owner: 'packages/evidence',
    canonicalPath: 'packages/evidence/src/vault.ts',
    layer: 'domain',
    notes: 'Hash-chained Evidence Vault; Access modules emit evidence references only.',
  },
} satisfies Record<string, AccessConceptOwner>);

/** Allowed dependency direction: consumer/orchestration → domain → ports (never reverse). */
export const ACCESS_ALLOWED_DEPENDENCY_DIRECTIONS = Object.freeze([
  'packages/human-access-economy → packages/access-economy',
  'packages/human-access-economy → packages/access-fabric',
  'packages/human-access-economy → packages/sunrey-access',
  'packages/human-access-economy → packages/sunrey-access-fabric',
  'packages/access-economy → packages/domain',
  'packages/access-economy → packages/money',
  'packages/access-economy → packages/evidence',
  'packages/access-fabric → packages/domain',
  'packages/sunrey-access → packages/domain',
  'packages/sunrey-access-fabric → packages/domain',
  'packages/sunrey-economics → packages/access-fabric',
  'packages/sunrey-economics → packages/access-economy',
  'services/api → packages/human-access-economy',
  'packages/sunrey-exchange/src/access-fabric → packages/ledger',
  'packages/sunrey-chain/src/access → packages/evidence',
  'packages/agent → packages/agent/src/access-fabric',
  'packages/sunrey-agent → packages/kernel',
]);

/** Forbidden competing package roots (aligned with manifest.forbiddenWorkspaceRoots access entries). */
export const ACCESS_FORBIDDEN_COMPETING_PACKAGES = Object.freeze([
  'packages/access-chain',
  'packages/access-ledger',
  'packages/access-coin',
  'packages/access-token',
  'packages/access-core',
  'packages/access-exchange',
  'packages/access-custody',
  'packages/access-simulation',
  'packages/entitlements',
  'packages/access-rights-chain',
  'packages/reservation-chain',
  'packages/reservation-ledger',
  'packages/rights-chain',
  'packages/mobility-chain',
  'packages/entitlement-chain',
]);

/** Named duplicate types and their intentional layering (only accidental duplicates should be removed). */
export const ACCESS_NAMED_DUPLICATE_TYPES: readonly NamedDuplicateType[] = Object.freeze([
  {
    typeName: 'AccessIntent',
    owner: 'packages/access-economy',
    classification: 'canonical',
    alsoDefinedIn: [
      'packages/human-access-economy/src/types.ts',
      'packages/agent/src/access-fabric/types.ts',
      'packages/sunrey-sdk/src/consumer-bff/types.ts',
    ],
  },
  {
    typeName: 'AccessEntitlement',
    owner: 'packages/access-economy',
    classification: 'canonical',
    alsoDefinedIn: [
      'packages/access-fabric/src/types.ts',
      'packages/human-access-economy/src/types.ts',
      'packages/access-economy/src/domain/types.ts',
    ],
  },
  {
    typeName: 'AllocationDecision',
    owner: 'packages/access-economy',
    classification: 'canonical',
    alsoDefinedIn: ['packages/sunrey-access/src/scarcity/types.ts'],
  },
  {
    typeName: 'AccessEntitlement (engine grant)',
    owner: 'packages/access-fabric',
    classification: 'adapter',
  },
  {
    typeName: 'AccessIntent (agent proposal)',
    owner: 'packages/agent/src/access-fabric',
    classification: 'adapter',
  },
  {
    typeName: 'AccessIntent (consumer product)',
    owner: 'packages/human-access-economy',
    classification: 'transport-dto',
  },
  {
    typeName: 'AccessRequest (simulation)',
    owner: 'packages/sunrey-economics/src/access-economy',
    classification: 'adapter',
  },
  {
    typeName: 'AccessRight (composer slice)',
    owner: 'packages/sunrey-access-fabric',
    classification: 'adapter',
    alsoDefinedIn: ['packages/access-economy/src/types.ts'],
  },
  {
    typeName: 'Settlement (exchange clearing)',
    owner: 'packages/sunrey-exchange/src/access-fabric',
    classification: 'adapter',
  },
  {
    typeName: 'EntitlementLedgerEntry',
    owner: 'packages/access-economy/src/funding-solvency',
    classification: 'canonical',
  },
]);

export const ACCESS_HIN_BOUNDARY = Object.freeze({
  hinOwnsIdentity: false,
  hinOwnsAttribution: false,
  hinOwnsValueCalculation: false,
  hinConsumesEvents: false,
  hinProducesSignals: true,
  hinParticipatesInAllocation: false,
  accessEconomyOwns: 'participation snapshot and bridge orchestration',
  informationMarketOwns: 'HIN opportunity, consent, and compensation adapters',
  personalDataCrossesBoundary: false,
  onlySettledSunReyAffectsTwab: true,
  contractPath: 'packages/access-economy/src/hin-access/contract.ts',
});

export const ACCESS_DUAL_TOKEN_BOUNDARY = Object.freeze({
  economicAllocationOwner: 'packages/access-economy/src/dual-token-allocation',
  tokenAmountOwner: 'packages/access-economy/src/dual-token-allocation',
  denominationOwner: 'packages/money',
  settlementInstructionOwner: 'packages/access-economy/src/settlement',
  financialLedgerMutationOwner: 'packages/ledger',
  exchangeClearingOwner: 'packages/sunrey-exchange/src/access-fabric/clearing.ts',
  custodyRailOwner: 'packages/custody',
  mintingOwner: 'packages/sunrey-chain/src/economics',
  noFixedPeg: true,
  noAutomaticIssuance: true,
});

export const ACCESS_POLICY_COMPLIANCE_BOUNDARY = Object.freeze({
  accessDomainPolicyOwner: 'packages/access-fabric',
  complianceKernelOwner: 'packages/kernel',
  accessPolicyMayOnlyDenyOrDefer: true,
  accessMustNotOverrideKernelRefusal: true,
  kernelMustNotOwnEconomicAllocation: true,
  regulatoryControlsOwner: 'packages/access-economy/src/regulatory-controls',
  regulatoryTwinOwner: 'packages/regulatory-twin',
  interface: 'AccessPolicyPort.check → eligibility; Kernel.submit → Execution Authority for consequential mutation',
});

/** Canonical end-to-end request lifecycle stage owners (actual repository flow). */
export const ACCESS_CANONICAL_LIFECYCLE = Object.freeze([
  { stage: 'Human / Agent intent', owner: 'packages/agent | packages/personal-economic-graph' },
  { stage: 'AccessIntent (proposal or registry)', owner: 'packages/access-economy' },
  { stage: 'Identity + session context', owner: 'packages/identity' },
  { stage: 'Policy / eligibility', owner: 'packages/access-fabric' },
  { stage: 'Productive capacity discovery', owner: 'packages/sunrey-access-fabric' },
  { stage: 'Scarcity quote + mechanism selection', owner: 'packages/sunrey-access' },
  { stage: 'Dual-token / epoch allocation', owner: 'packages/access-economy/dual-token-allocation' },
  { stage: 'Capacity reservation hold/confirm', owner: 'packages/access-fabric' },
  { stage: 'Compliance Kernel (consequential)', owner: 'packages/kernel' },
  { stage: 'Exchange clearing / fiat settlement', owner: 'packages/sunrey-exchange/access-fabric | packages/access-economy/settlement' },
  { stage: 'Chain access commitment + evidence', owner: 'packages/sunrey-chain/access' },
  { stage: 'Provider fulfillment / redemption', owner: 'packages/access-economy/providers' },
  { stage: 'Entitlement ledger + audit', owner: 'packages/access-economy/funding-solvency | packages/evidence' },
  { stage: 'HIN participation bridge (optional)', owner: 'packages/access-economy/hin-access' },
  { stage: 'Consumer BFF projection', owner: 'packages/human-access-economy → services/api' },
]);
