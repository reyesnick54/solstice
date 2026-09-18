import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { LegalReviewStatus } from '../types.ts';
import type {
  CapabilityAction,
  CapabilityCategory,
  CapabilityQueryOutcome,
  HeliosJurisdictionId,
  JurisdictionCapabilityState,
  ProviderDependencyState,
} from './taxonomy.ts';

export type JurisdictionOverlayKind = 'EU_MEMBER_STATE' | 'US_STATE' | 'LEGAL_ENTITY' | 'PROVIDER';

export type JurisdictionOverlay = {
  readonly overlayId: string;
  readonly kind: JurisdictionOverlayKind;
  readonly overlayKey: string;
  readonly parentJurisdictionId: HeliosJurisdictionId;
  readonly description: string;
  readonly sourceReference: string;
  readonly legalReviewStatus: LegalReviewStatus;
};

export type JurisdictionCapabilityDefinition = {
  readonly capabilityId: string;
  readonly jurisdictionId: HeliosJurisdictionId;
  readonly jurisdictionVersion: string;
  readonly legalEntityId: string;
  readonly productId: string | null;
  readonly customerClass: string | null;
  readonly accountClass: string | null;
  readonly providerId: string | null;
  readonly action: CapabilityAction;
  readonly instrumentClass: string | null;
  readonly advisoryClassification: string | null;
  readonly environment: 'simulation' | 'live';
  readonly status: JurisdictionCapabilityState;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly evidenceRefs: readonly string[];
  readonly counselReviewState: LegalReviewStatus;
  readonly policyVersion: string;
  readonly reasonCodes: readonly string[];
  readonly restrictions: readonly string[];
  readonly providerDependency: ProviderDependencyState;
  readonly reportingObligationRefs: readonly string[];
  readonly requiredControls: readonly string[];
  readonly requiredApprovalClass: string | null;
  readonly sourceReference: string;
  readonly overlayId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type JurisdictionCapabilityPack = {
  readonly packId: HeliosJurisdictionId;
  readonly packVersion: string;
  readonly name: string;
  readonly description: string;
  readonly legalReviewStatus: LegalReviewStatus;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly sourceReference: string;
  readonly capabilities: readonly JurisdictionCapabilityDefinition[];
  readonly overlays: readonly JurisdictionOverlay[];
};

export type CanPerformInput = {
  readonly legalEntityId: string;
  readonly customerId: string;
  readonly customerClass: string;
  readonly jurisdiction: string;
  readonly productId: string;
  readonly action: CapabilityAction;
  readonly accountId: string;
  readonly accountClass: string;
  readonly providerId?: string;
  readonly instrumentClass?: string;
  readonly environment: 'simulation' | 'live';
  readonly stateOverlay?: string;
  readonly memberState?: string;
  readonly at: UtcInstant;
};

export type CanPerformResult = {
  readonly outcome: CapabilityQueryOutcome;
  readonly jurisdictionId: HeliosJurisdictionId | null;
  readonly resolvedOverlayId: string | null;
  readonly legalEntityId: string;
  readonly policyVersion: string;
  readonly capabilityId: string | null;
  readonly capabilityStatus: JurisdictionCapabilityState | null;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly requiredControls: readonly string[];
  readonly requiredApprovalClass: string | null;
  readonly reportingObligationRefs: readonly string[];
  readonly providerDependency: ProviderDependencyState | null;
  readonly restrictions: readonly string[];
  readonly evaluatedAt: UtcInstant;
};

export type CapabilityDecisionRecord = {
  readonly decisionId: string;
  readonly input: CanPerformInput;
  readonly result: CanPerformResult;
  readonly sealedAt: UtcInstant;
};

export type JurisdictionCapabilityStoreSnapshot = {
  readonly packs: readonly JurisdictionCapabilityPack[];
  readonly decisions: readonly CapabilityDecisionRecord[];
  readonly activePackVersions: Readonly<Record<string, string>>;
};
