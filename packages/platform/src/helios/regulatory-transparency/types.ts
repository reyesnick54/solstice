import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  SupervisoryExportRequestId,
  SupervisoryExportPackageId,
  RegulatoryChangeRequestId,
  PolicyVersionRef,
} from './ids.ts';
import type {
  SupervisoryRole,
  ExportMode,
  ExportApprovalState,
  ArtifactClass,
  ChangeRequestState,
  OfficialSourceKind,
  ActivationMode,
  ActorKind,
} from './taxonomy.ts';

export type SupervisoryActor = {
  readonly operatorId: string;
  readonly role: SupervisoryRole;
  readonly actorKind: ActorKind;
};

export type ExportScope = {
  readonly jurisdictions: readonly Jurisdiction[];
  readonly customerIds: readonly CustomerId[];
  readonly accountIds: readonly string[];
  readonly dateRangeStart: UtcInstant;
  readonly dateRangeEnd: UtcInstant;
  readonly artifactClasses: readonly ArtifactClass[];
};

export type SupervisoryExportRequest = {
  readonly exportRequestId: SupervisoryExportRequestId;
  readonly requestingAuthority: SupervisoryActor;
  readonly legalBasisRef: string;
  readonly purposeRef: string;
  readonly exportMode: ExportMode;
  readonly scope: ExportScope;
  readonly approvalState: ExportApprovalState;
  readonly approvedBy: SupervisoryActor | null;
  readonly approvedAt: UtcInstant | null;
  readonly generatedAt: UtcInstant | null;
  readonly accessExpiry: UtcInstant | null;
  readonly packageRefs: readonly SupervisoryExportPackageId[];
  readonly auditTrailRefs: readonly string[];
  readonly createdAt: UtcInstant;
};

export type RedactionRecord = {
  readonly originalEvidenceRef: string;
  readonly exportTransformation: 'PSEUDONYMIZED' | 'REDACTED' | 'IDENTIFIED';
  readonly redactionRuleVersion: string;
  readonly artifactHash: string;
};

export type ExportArtifact = {
  readonly artifactClass: ArtifactClass;
  readonly contentHash: string;
  readonly sourceEvidenceRefs: readonly string[];
  readonly redaction: RedactionRecord | null;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type ExportManifest = {
  readonly packageId: SupervisoryExportPackageId;
  readonly exportRequestId: SupervisoryExportRequestId;
  readonly policyVersion: string;
  readonly generatedAt: UtcInstant;
  readonly artifactChecksums: Readonly<Record<string, string>>;
  readonly sourceEvidenceRefs: readonly string[];
  readonly manifestHash: string;
};

export type SupervisoryExportPackage = {
  readonly packageId: SupervisoryExportPackageId;
  readonly exportRequestId: SupervisoryExportRequestId;
  readonly manifest: ExportManifest;
  readonly artifacts: readonly ExportArtifact[];
  readonly packageHash: string;
  readonly grantsFinancialEffect: false;
  readonly grantsExecutionAuthority: false;
};

export type OfficialSourceReference = {
  readonly sourceId: string;
  readonly kind: OfficialSourceKind;
  readonly citation: string;
  readonly evidenceRef: string;
  readonly capturedAt: UtcInstant;
};

export type ApplicabilityAssessment = {
  readonly jurisdictions: readonly Jurisdiction[];
  readonly legalEntities: readonly string[];
  readonly products: readonly string[];
  readonly customerClasses: readonly string[];
  readonly providers: readonly string[];
  readonly strategyActionTypes: readonly string[];
  readonly affectedControls: readonly string[];
  readonly effectiveDate: UtcInstant | null;
  readonly uncertainty: 'RESOLVED' | 'UNKNOWN';
  readonly reviewer: SupervisoryActor | null;
};

export type PolicyChangeTestResult = {
  readonly testSuiteId: string;
  readonly passed: boolean;
  readonly unitTestsPassed: boolean;
  readonly capabilityTestsPassed: boolean;
  readonly negativeTestsPassed: boolean;
  readonly regressionTestsPassed: boolean;
  readonly jurisdictionTestsPassed: boolean;
  readonly shadowEvaluationPassed: boolean;
  readonly evidenceRef: string;
  readonly executedAt: UtcInstant;
};

export type PolicyVersionRecord = {
  readonly versionRef: PolicyVersionRef;
  readonly packId: string;
  readonly versionNumber: string;
  readonly contentHash: string;
  readonly previousVersionRef: PolicyVersionRef | null;
  readonly immutable: true;
  readonly activatedAt: UtcInstant | null;
  readonly retiredAt: UtcInstant | null;
};

export type RegulatoryChangeRequest = {
  readonly changeRequestId: RegulatoryChangeRequestId;
  readonly state: ChangeRequestState;
  readonly officialSource: OfficialSourceReference;
  readonly applicability: ApplicabilityAssessment | null;
  readonly proposedPolicyVersion: PolicyVersionRecord | null;
  readonly currentPolicyVersionRef: PolicyVersionRef;
  readonly testResults: readonly PolicyChangeTestResult[];
  readonly activationMode: ActivationMode | null;
  readonly scheduledEffectiveAt: UtcInstant | null;
  readonly activatedAt: UtcInstant | null;
  readonly approvals: readonly ChangeApprovalRecord[];
  readonly auditTrailRefs: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly createdBy: SupervisoryActor;
};

export type ChangeApprovalRecord = {
  readonly approver: SupervisoryActor;
  readonly approvedAt: UtcInstant;
  readonly evidenceRef: string;
};

export type ActionDecisionReconstruction = {
  readonly actionRef: string;
  readonly outcome: 'ALLOW' | 'REFUSE' | 'REVIEW_REQUIRED' | 'UNKNOWN';
  readonly policyVersionRef: PolicyVersionRef;
  readonly capabilityContext: Readonly<Record<string, unknown>>;
  readonly controlEvidenceRefs: readonly string[];
  readonly financialEvidenceRefs: readonly string[];
  readonly reportingHistoryRefs: readonly string[];
  readonly modelStrategyVersions: readonly string[];
  readonly changeGovernanceRefs: readonly string[];
  readonly reconstructedAt: UtcInstant;
};

export type RegulatoryTransparencyStoreSnapshot = {
  readonly exportRequests: readonly SupervisoryExportRequest[];
  readonly exportPackages: readonly SupervisoryExportPackage[];
  readonly changeRequests: readonly RegulatoryChangeRequest[];
  readonly policyVersions: readonly PolicyVersionRecord[];
  readonly activatedVersionRefs: readonly PolicyVersionRef[];
  readonly scheduledActivations: readonly ScheduledActivation[];
};

export type ScheduledActivation = {
  readonly changeRequestId: RegulatoryChangeRequestId;
  readonly policyVersionRef: PolicyVersionRef;
  readonly effectiveAt: UtcInstant;
  readonly executed: boolean;
};

export type ExportAuthorizationResult = {
  readonly permitted: boolean;
  readonly reason: string;
  readonly requiredApproval: boolean;
};

export type EvidenceSourcePort = {
  queryByRefs(refs: readonly string[]): readonly { readonly ref: string; readonly kind: string; readonly payload: unknown }[];
  queryByScope(input: {
    readonly customerIds: readonly CustomerId[];
    readonly jurisdictions: readonly Jurisdiction[];
    readonly dateRangeStart: UtcInstant;
    readonly dateRangeEnd: UtcInstant;
    readonly artifactClasses: readonly ArtifactClass[];
  }): readonly { readonly ref: string; readonly kind: string; readonly payload: unknown; readonly artifactClass: ArtifactClass }[];
};
