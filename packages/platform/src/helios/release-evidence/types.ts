/**
 * HELIOS H36 — release evidence package and live-pilot gate types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  ExternalEvidenceKind,
  GovernanceApprovalRole,
  LivePilotGateClass,
  LivePilotGateState,
  PilotAbortCondition,
  PilotActivationCeremonyStep,
  WorkPackageStatus,
} from './taxonomy.ts';
import type {
  ExternalGateItemId,
  HeliosReleaseId,
  LivePilotAuthorizationId,
  LivePilotScopeId,
} from './ids.ts';

export type ExternalEvidenceRef = {
  readonly evidenceRef: string;
  readonly kind: ExternalEvidenceKind;
  readonly description: string;
  readonly recordedAt: UtcInstant;
  readonly sha256?: string | null;
  readonly expiresAt?: UtcInstant | null;
};

export type QualificationEvidenceRef = {
  readonly checkId: string;
  readonly qualified: boolean;
  readonly marker?: string | null;
  readonly evidenceRef: string;
  readonly notes?: readonly string[];
};

export type ReleaseIdentitySection = {
  readonly releaseId: HeliosReleaseId;
  readonly gitSha: string;
  readonly baseSha?: string | null;
  readonly artifactDigest: string;
  readonly releaseManifestRef: string;
  readonly buildWorkflowRef: string;
  readonly buildRunRef: string;
  readonly releaseDate: UtcInstant;
  readonly environment: string;
};

export type EngineeringEvidenceSection = {
  readonly architectureChecks: QualificationEvidenceRef;
  readonly typecheckBuild: QualificationEvidenceRef;
  readonly databaseQualification: QualificationEvidenceRef;
  readonly migrations: QualificationEvidenceRef;
  readonly apiOpenApi: QualificationEvidenceRef;
  readonly persistenceRestart: QualificationEvidenceRef;
  readonly customerIsolation: QualificationEvidenceRef;
  readonly securitySafetyChecks: QualificationEvidenceRef;
  readonly resilienceH31: QualificationEvidenceRef;
  readonly economicEvaluationH32: QualificationEvidenceRef;
  readonly capacityLatencyH33: QualificationEvidenceRef;
  readonly rollbackH34: QualificationEvidenceRef;
  readonly integratedAcceptanceH35: QualificationEvidenceRef;
  readonly engineeringQualified: boolean;
  readonly blockers: readonly string[];
};

export type IntelligenceEvidenceSection = {
  readonly qualifiedModelProviderState: string;
  readonly grokQualification: QualificationEvidenceRef;
  readonly s3mQualification: QualificationEvidenceRef;
  readonly strategyLabStatus: string;
  readonly strategyCapsules: readonly string[];
  readonly qualificationPromotionEvidence: readonly ExternalEvidenceRef[];
  readonly knownLimitations: readonly string[];
};

export type DataProviderEvidenceSection = {
  readonly marketEconomicProviders: readonly string[];
  readonly feedEntitlementStatus: string;
  readonly freshnessHandling: QualificationEvidenceRef;
  readonly provenance: QualificationEvidenceRef;
  readonly externalQualificationStatus: string;
  readonly licensingCommercialUseStatus: string;
};

export type FinancialProviderEvidenceRow = {
  readonly providerId: string;
  readonly productCapability: string;
  readonly sandboxCertificationStatus: string;
  readonly accountCapability: string;
  readonly fundingCapability: string;
  readonly tradingCapability: string;
  readonly custodyCapability: string;
  readonly withdrawalCapability: string;
  readonly productionCredentialStatus: string;
  readonly contractStatus: string;
  readonly externalEvidenceRefs: readonly ExternalEvidenceRef[];
};

export type RegulatoryEvidenceSection = {
  readonly jurisdictions: readonly string[];
  readonly legalEntities: readonly string[];
  readonly capabilityPackVersions: readonly string[];
  readonly legalComplianceReviewStatus: string;
  readonly requiredLicensesPartnerBases: readonly string[];
  readonly reportingResponsibility: string;
  readonly regulatoryEvidenceState: string;
  readonly unresolvedItems: readonly string[];
};

export type SecurityEvidenceSection = {
  readonly securityReviewStatus: string;
  readonly penetrationAdversarialEvidence: readonly ExternalEvidenceRef[];
  readonly keyHsmCustodyStatus: string;
  readonly secretsManagement: string;
  readonly incidentOperationalReadiness: string;
  readonly unresolvedSecurityFindings: readonly string[];
};

export type OperationsEvidenceSection = {
  readonly hetznerRelease: QualificationEvidenceRef;
  readonly postgresql: QualificationEvidenceRef;
  readonly backups: string;
  readonly monitoring: string;
  readonly alerting: string;
  readonly rollback: QualificationEvidenceRef;
  readonly supportOnCallResponsibility: string;
  readonly reconciliationOperations: QualificationEvidenceRef;
  readonly incidentProcedures: string;
};

export type ProductEvidenceSection = {
  readonly consumerBff: QualificationEvidenceRef;
  readonly growAgentContract: QualificationEvidenceRef;
  readonly appAcceptance: QualificationEvidenceRef;
  readonly pauseCloseWithdraw: QualificationEvidenceRef;
  readonly degradedStates: QualificationEvidenceRef;
  readonly customerDisclosures: string;
  readonly environmentLabeling: string;
};

export type PerformanceEvidenceSection = {
  readonly paperShadowExperimentResults: readonly string[];
  readonly unsuccessfulExperiments: readonly string[];
  readonly feesCostsNotes: readonly string[];
  readonly drawdownNotes: readonly string[];
  readonly capacityLimits: readonly string[];
  readonly microcapitalExperimentEvidence: readonly string[];
  readonly performanceClaimRestrictions: readonly string[];
};

export type HELIOSReleaseEvidencePackage = {
  readonly schema: 'sunrey.helios.release-evidence.v1';
  readonly packageHash: string;
  readonly identity: ReleaseIdentitySection;
  readonly engineering: EngineeringEvidenceSection;
  readonly intelligence: IntelligenceEvidenceSection;
  readonly data: DataProviderEvidenceSection;
  readonly financialProviders: readonly FinancialProviderEvidenceRow[];
  readonly regulatory: RegulatoryEvidenceSection;
  readonly security: SecurityEvidenceSection;
  readonly operations: OperationsEvidenceSection;
  readonly product: ProductEvidenceSection;
  readonly performance: PerformanceEvidenceSection;
  readonly knownLimitations: readonly string[];
  readonly architectureInvariantsVerified: readonly string[];
  readonly sealedAt: UtcInstant;
};

export type LivePilotScope = {
  readonly scopeId: LivePilotScopeId;
  readonly jurisdiction: string;
  readonly legalEntity: string;
  readonly customerClass: string;
  readonly customers: readonly string[];
  readonly product: string;
  readonly provider: string;
  readonly accountType: string;
  readonly instrumentProductClasses: readonly string[];
  readonly maximumCapitalMinor: bigint;
  readonly currency: string;
  readonly strategyCapsuleIds: readonly string[];
  readonly modelVersions: readonly string[];
  readonly startDate: UtcInstant;
  readonly endDate: UtcInstant;
  readonly riskLimits: readonly string[];
  readonly reportingBasis: string;
  readonly environment: string;
  readonly operationalOwnerRole: GovernanceApprovalRole;
};

export type LivePilotGateItem = {
  readonly itemId: ExternalGateItemId;
  readonly gateClass: LivePilotGateClass;
  readonly itemKey: string;
  readonly description: string;
  readonly state: LivePilotGateState;
  readonly requiresExternalEvidence: boolean;
  readonly evidenceRefs: readonly ExternalEvidenceRef[];
  readonly notes: readonly string[];
  readonly updatedAt: UtcInstant;
};

export type LivePilotGate = {
  readonly schema: 'sunrey.helios.live-pilot-gate.v1';
  readonly scope: LivePilotScope;
  readonly releaseId: HeliosReleaseId;
  readonly releaseGitSha: string;
  readonly items: readonly LivePilotGateItem[];
  readonly mandatoryAbortConditions: readonly PilotAbortCondition[];
  readonly missingExternalEvidence: readonly string[];
  readonly allGatesSatisfied: boolean;
  readonly evaluatedAt: UtcInstant;
};

export type GovernanceApproverRecord = {
  readonly role: GovernanceApprovalRole;
  readonly approvalRecordRef: string;
  readonly approvedAt: UtcInstant;
};

export type LivePilotAuthorization = {
  readonly schema: 'sunrey.helios.live-pilot-authorization.v1';
  readonly authorizationId: LivePilotAuthorizationId;
  readonly pilotScope: LivePilotScope;
  readonly releaseId: HeliosReleaseId;
  readonly releaseGitSha: string;
  readonly externalGateStatus: string;
  readonly approvers: readonly GovernanceApproverRecord[];
  readonly approvedAt: UtcInstant;
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly capitalCeilingMinor: bigint;
  readonly customerScope: readonly string[];
  readonly providerScope: readonly string[];
  readonly jurisdiction: string;
  readonly allowedStrategyCapsules: readonly string[];
  readonly abortConditions: readonly PilotAbortCondition[];
  readonly evidenceRefs: readonly ExternalEvidenceRef[];
  readonly aiSigned: false;
  readonly activatesLiveConnectivity: false;
};

export type PilotActivationCeremonyContract = {
  readonly ceremonyId: string;
  readonly releaseId: HeliosReleaseId;
  readonly scopeId: LivePilotScopeId;
  readonly steps: readonly {
    readonly step: PilotActivationCeremonyStep;
    readonly description: string;
    readonly requiresHumanAction: boolean;
    readonly mayActivateLiveConnectivity: false;
  }[];
  readonly abortOnFailure: true;
  readonly expandsOnlyThroughNewAuthorization: true;
};

export type PilotAbortPolicy = {
  readonly mandatoryConditions: readonly PilotAbortCondition[];
  readonly onAbort: readonly string[];
  readonly preservesEvidence: true;
  readonly preservesWithdrawalRights: true;
  readonly failClosed: true;
};

export type WorkPackageStatusRow = {
  readonly workPackage: string;
  readonly title: string;
  readonly status: WorkPackageStatus;
  readonly evidenceRef: string;
  readonly notes?: string;
};

export type HeliosClosureReport = {
  readonly schema: 'sunrey.helios.closure-report.v1';
  readonly generatedAt: UtcInstant;
  readonly releaseSha: string;
  readonly baseSha?: string | null;
  readonly releaseArtifactDigest: string;
  readonly h01ThroughH36: readonly WorkPackageStatusRow[];
  readonly architectureQualification: string;
  readonly dataProviderStatus: string;
  readonly modelsStatus: string;
  readonly strategyStatus: string;
  readonly financialOperationsStatus: string;
  readonly regulatoryFrameworkStatus: string;
  readonly resilienceStatus: string;
  readonly economicEvaluationStatus: string;
  readonly capacityStatus: string;
  readonly deploymentAcceptanceStatus: string;
  readonly externalGatesStatus: string;
  readonly pilotEligibility: string;
  readonly knownLimitations: readonly string[];
  readonly recommendedNextAuthorizedAction: string;
  readonly releaseCandidateStatus:
    | 'HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING'
    | 'HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION'
    | 'HELIOS_RC_BLOCKED';
  readonly humanReadableSummary: string;
};

export type ReleaseCandidateQualificationResult = {
  readonly marker:
    | 'HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING'
    | 'HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION'
    | 'HELIOS_RC_BLOCKED';
  readonly engineeringQualified: boolean;
  readonly externalGatesComplete: boolean;
  readonly readyForHumanPilotAuthorization: boolean;
  readonly blockers: readonly string[];
  readonly releaseEvidence: HELIOSReleaseEvidencePackage;
  readonly livePilotGate?: LivePilotGate | null;
};

export type ReleaseEvidenceStoreSnapshot = {
  readonly packages: readonly HELIOSReleaseEvidencePackage[];
  readonly gates: readonly LivePilotGate[];
  readonly authorizations: readonly LivePilotAuthorization[];
};
