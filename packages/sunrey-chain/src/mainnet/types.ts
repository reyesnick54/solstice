/**
 * Chunk 65 — SunRey mainnet readiness and genesis-candidate types.
 *
 * This is an engineering control plane. It does not launch mainnet,
 * enable LIVE_* services, or convert software evidence into legal
 * approval. External counsel, licenses, audits, and human signatures
 * remain explicit slots.
 */

export const MAINNET_READINESS_SCHEMA_VERSION = 1 as const;
export const MAINNET_READINESS_TOOL_VERSION = 'sunrey-mainnet/1' as const;

export const EVIDENCE_STATES = [
  'NOT_PROVIDED',
  'PROVIDED_UNVERIFIED',
  'ENGINEERING_VERIFIED',
  'EXTERNAL_VERIFICATION_REQUIRED',
  'HUMAN_VERIFIED',
  'NOT_APPLICABLE',
] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const READINESS_DIMENSIONS = [
  'PROTOCOL',
  'CONSENSUS',
  'FORMAL_ASSURANCE',
  'SECURITY_TESTING',
  'EXTERNAL_SECURITY_REVIEW',
  'CRYPTOGRAPHY',
  'PQC',
  'SUPPLY_CHAIN',
  'RELEASE',
  'VALIDATOR_OPERATIONS',
  'VALIDATOR_ECONOMICS',
  'ROOT_OF_TRUST',
  'GENESIS',
  'OBSERVABILITY',
  'DISASTER_RECOVERY',
  'STORAGE',
  'PERFORMANCE',
  'PRIVACY',
  'CUSTODY',
  'EXCHANGE',
  'COMPLIANCE',
  'LEGAL',
  'REGULATORY',
  'LICENSING',
  'PARTNER_DEPENDENCIES',
  'HUMAN_AUTHORIZATION',
  'INFRASTRUCTURE',
  'DUAL_ECONOMY_MODELING',
  'GOVERNANCE_OPERATIONS',
  'ECONOMIC_STRESS',
  'POST_GENESIS_OPERATIONS',
] as const;
export type MainnetReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

export const ACTIVATION_DOMAINS = [
  'SUNREY_CHAIN',
  'SUNREY_COIN_NATIVE_ASSET',
  'MOONREY_COIN_NATIVE_ASSET',
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'FIAT_BANKING',
  'PAYMENT_RAILS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
  'INTEROPERABILITY',
] as const;
export type ActivationDomain = (typeof ACTIVATION_DOMAINS)[number];

export const EVALUATOR_STATUSES = [
  'INCOMPLETE',
  'ENGINEERING_READY_FOR_HUMAN_REVIEW',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_AUTHORIZATION',
  'AUTHORIZED_CANDIDATE',
] as const;
export type ReadinessEvaluatorStatus = (typeof EVALUATOR_STATUSES)[number];

export const AUTHORIZATION_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
  'LEGAL_AUTHORITY',
  'REGULATORY_AUTHORITY',
] as const;
export type AuthorizationRole = (typeof AUTHORIZATION_ROLES)[number];

export const REQUIRED_HUMAN_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
] as const;
export type RequiredHumanRole = (typeof REQUIRED_HUMAN_ROLES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'AGENT', 'AUTOMATION'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const CANDIDATE_STATUSES = [
  'CANDIDATE',
  'REJECTED',
  'SUPERSEDED',
  'AUTHORIZED_CANDIDATE',
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CEREMONY_KINDS = ['SIMULATION_REHEARSAL', 'REAL_EXTERNAL_CEREMONY'] as const;
export type CeremonyKind = (typeof CEREMONY_KINDS)[number];

export const HSM_EVIDENCE_CLASSES = ['SIMULATION_HSM', 'REAL_PROVIDER_HSM'] as const;
export type HsmEvidenceClass = (typeof HSM_EVIDENCE_CLASSES)[number];

export const ALLOCATION_CATEGORIES = [
  'UNALLOCATED',
  'VALIDATOR_OPERATIONS',
  'PROTOCOL_RESERVE',
  'EXPLICITLY_AUTHORIZED',
] as const;
export type AllocationCategory = (typeof ALLOCATION_CATEGORIES)[number];

export const EVIDENCE_TYPES = [
  'ENGINEERING_ARTIFACT',
  'SOFTWARE_TEST',
  'FORMAL_MODEL',
  'EXTERNAL_AUDIT_REPORT',
  'COUNSEL_OPINION',
  'LICENSE_OR_REGISTRATION',
  'REGULATORY_APPROVAL',
  'PARTNER_AGREEMENT',
  'HUMAN_AUTHORIZATION',
  'CEREMONY_TRANSCRIPT',
  'RELEASE_ARTIFACT',
  'CAPACITY_MEASUREMENT',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const VERIFIER_ROLES = [
  'ENGINEERING',
  'SECURITY',
  'OPERATIONS',
  'RELEASE',
  'EXTERNAL_AUDITOR',
  'COUNSEL',
  'REGULATOR',
  'HUMAN_AUTHORITY',
] as const;
export type VerifierRole = (typeof VERIFIER_ROLES)[number];

export type ReadinessEvidenceRecord = {
  readonly requirementId: string;
  readonly dimension: MainnetReadinessDimension;
  readonly description: string;
  readonly scope: string;
  readonly evidenceType: EvidenceType;
  readonly evidenceHash: string | null;
  readonly evidenceReference: string | null;
  readonly source: string;
  readonly verificationStatus: EvidenceState;
  readonly authorizedVerifierRole: VerifierRole;
  readonly expirationOrReviewDateUtc: string | null;
  readonly notes: string;
  readonly externalEvidence: boolean;
  readonly chunkReference: string | null;
};

export type ProductionCapabilityActivation = {
  readonly capability: ActivationDomain;
  readonly software_ready: boolean;
  readonly security_ready: boolean;
  readonly operational_ready: boolean;
  readonly legal_ready: boolean;
  readonly regulatory_ready: boolean;
  readonly license_or_partner_ready: boolean;
  readonly human_authorized: boolean;
  readonly genesis_enabled: boolean;
  readonly runtime_enabled: boolean;
};

export type MainnetAuthorizationRecord = {
  readonly recordId: string;
  readonly actorKind: ActorKind;
  readonly actorId: string;
  readonly role: AuthorizationRole;
  readonly statement: string;
  readonly signedAtUtc: string;
  readonly signatureHex: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type GenesisAllocationLine = {
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly recipientAccount: string;
  readonly quantityMinorUnits: bigint;
  readonly purposeCategory: AllocationCategory;
  readonly authorizationEvidence: string | null;
};

export type GenesisAssetAllocationManifest = {
  readonly schemaVersion: 1;
  readonly policyVersion: string;
  readonly productionAllocationAuthorized: boolean;
  readonly inheritedTestnetFaucet: false;
  readonly migratedApplicationLedgerBalances: false;
  readonly wrappedFiat: false;
  readonly hiddenPremint: false;
  readonly lines: readonly GenesisAllocationLine[];
  readonly totalByAsset: { readonly SUNREY_COIN: bigint; readonly MOONREY_COIN: bigint };
  readonly approvals: readonly MainnetAuthorizationRecord[];
  readonly notes: string;
};

export type MainnetValidatorCandidate = {
  readonly validatorId: string;
  readonly operatorEntityReference: string;
  readonly consensusPublicKeyHex: string;
  readonly p2pPublicKeyHex: string;
  readonly governancePublicKeyHex: string;
  readonly cryptoSuite: string;
  readonly hsmAttestationReference: string | null;
  readonly hsmEvidenceClass: HsmEvidenceClass;
  readonly failureDomain: string;
  readonly votingPower: bigint;
  readonly ceremonyContributionHash: string;
  readonly approvalState: EvidenceState;
};

export type ValidatorConcentrationReport = {
  readonly votingPowerWarnings: readonly string[];
  readonly failureDomainWarnings: readonly string[];
  readonly operatorWarnings: readonly string[];
  readonly organizationalIndependenceClaimed: false;
};

export type MainnetValidatorCandidateManifest = {
  readonly schemaVersion: 1;
  readonly validators: readonly MainnetValidatorCandidate[];
  readonly concentration: ValidatorConcentrationReport;
};

export type CryptographicPolicyManifest = {
  readonly policyId: string;
  readonly consensusSuiteId: string;
  readonly pqRequiredForConsensus: false;
  readonly hsmRequiredForConsensus: false;
  readonly productionPqProvider: null;
  readonly productionHsmProvider: null;
  readonly supportedRoles: readonly string[];
  readonly supportedProviders: readonly string[];
  readonly notes: string;
};

export type CeremonyBinding = {
  readonly kind: CeremonyKind;
  readonly transcriptHash: string | null;
  readonly transcriptReference: string | null;
  readonly processReadinessOnly: boolean;
  readonly provesRealProductionKeyCreation: false;
  readonly notes: string;
};

export type ExternalSecurityReviewSlot = {
  readonly reviewOrganization: string | null;
  readonly reviewReference: string | null;
  readonly scope: string;
  readonly reportHash: string | null;
  readonly openCriticalFindings: number | null;
  readonly openHighFindings: number | null;
  readonly retestEvidence: string | null;
  readonly status: EvidenceState;
  readonly notes: string;
};

export type FormalAssuranceSlot = {
  readonly modelVersions: readonly string[];
  readonly bounds: string | null;
  readonly properties: readonly string[];
  readonly counterexamples: readonly string[];
  readonly reportDigest: string | null;
  readonly status: EvidenceState;
  readonly substituteForImplementationReview: false;
  readonly notes: string;
};

export type TestnetReleaseCandidateSlot = {
  readonly rcId: string | null;
  readonly sourceCommit: string | null;
  readonly qualificationReport: string | null;
  readonly knownLimitations: readonly string[];
  readonly enduranceState: EvidenceState;
  readonly upgradeRehearsal: EvidenceState;
  readonly disasterRecoveryResult: EvidenceState;
  readonly testnetGenesisHash: string;
  readonly status: EvidenceState;
  readonly notes: string;
};

export type EconomicReleaseCandidateSlot = {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly qualificationDigest: string;
  readonly engineeringStatus: 'ENGINEERING_VERIFIED';
  readonly mainnetAuthorized: false;
  readonly externalApprovalsRemain: true;
  readonly notes: string;
};

export type MainnetReleaseCandidateSlot = {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly qualificationDigest: string;
  readonly engineeringStatus: 'ENGINEERING_QUALIFIED' | 'AWAITING_EXTERNAL_EVIDENCE' | 'ENGINEERING_QUALIFICATION';
  readonly authorizedCandidate: false;
  readonly mainnetAuthorized: false;
  readonly externalApprovalsRemain: true;
  readonly notes: string;
};

export type LegalRegulatorySlot = {
  readonly counselOpinionReference: string | null;
  readonly licenseOrRegistration: string | null;
  readonly regulatoryApprovalReference: string | null;
  readonly regulatedPartnerAgreement: string | null;
  readonly jurisdictionOperatingApproval: string | null;
  readonly confirmedByCounsel: false;
  readonly status: EvidenceState;
  readonly notes: string;
};

export type ChecklistItem = {
  readonly id: string;
  readonly description: string;
  readonly status: EvidenceState;
  readonly softwareOnly: boolean;
  readonly notes: string;
};

export type ExchangeReadinessSlot = {
  readonly custodyReady: EvidenceState;
  readonly marketSurveillanceReady: EvidenceState;
  readonly listingGovernanceReady: EvidenceState;
  readonly travelRuleArchitectureReady: EvidenceState;
  readonly licensingOrRegistration: EvidenceState;
  readonly marketLegalApprovals: EvidenceState;
  readonly operationalStaffing: EvidenceState;
  readonly securityReview: EvidenceState;
  readonly softwareImplementationSufficient: false;
  readonly items: readonly ChecklistItem[];
};

export type CustodyReadinessSlot = {
  readonly realHsmOrProvider: EvidenceState;
  readonly keyCeremony: EvidenceState;
  readonly segregation: EvidenceState;
  readonly reconciliation: EvidenceState;
  readonly withdrawalApproval: EvidenceState;
  readonly disasterRecovery: EvidenceState;
  readonly securityReview: EvidenceState;
  readonly legalLicensingPartner: EvidenceState;
  readonly simulationHsmSatisfiesRealProvider: false;
  readonly items: readonly ChecklistItem[];
};

export type OracleReadinessSlot = {
  readonly technicalImplementation: EvidenceState;
  readonly providerConfigured: EvidenceState;
  readonly providerAgreementEvidence: EvidenceState;
  readonly productionEligible: EvidenceState;
  readonly realProviderAgreements: EvidenceState;
  readonly sourceDiversity: EvidenceState;
  readonly dataQuality: EvidenceState;
  readonly operationalMonitoring: EvidenceState;
  readonly keyManagement: EvidenceState;
  readonly jurisdictionConstraints: EvidenceState;
  readonly securityReview: EvidenceState;
  readonly developmentFixturesAreProductionFeeds: false;
  readonly items: readonly ChecklistItem[];
};

export type InteropReadinessSlot = {
  readonly externalChainVerifierImplemented: boolean;
  readonly securityReview: EvidenceState;
  readonly economicConservationAnalysis: EvidenceState;
  readonly operationalRelayers: EvidenceState;
  readonly incidentProcedures: EvidenceState;
  readonly legalComplianceReview: EvidenceState;
  readonly wrappedFiat: false;
  readonly separatelyControlled: true;
  readonly items: readonly ChecklistItem[];
};

export type PrivacyReadinessSlot = {
  readonly personalDataVault: EvidenceState;
  readonly consent: EvidenceState;
  readonly cleanRoom: EvidenceState;
  readonly dataResidency: EvidenceState;
  readonly retention: EvidenceState;
  readonly deletion: EvidenceState;
  readonly jurisdictionalPrivacyAnalysis: EvidenceState;
  readonly securityAssessment: EvidenceState;
  readonly humanLegalReview: EvidenceState;
  readonly items: readonly ChecklistItem[];
};

export type ProductionNetworkCandidate = {
  readonly displayName: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly productionAddressHrp: 'srprd';
  readonly protocolVersion: string;
  readonly genesisVersion: string;
  readonly cryptoPolicy: CryptographicPolicyManifest;
  readonly validatorSetCandidate: MainnetValidatorCandidateManifest;
  readonly moduleRegistry: readonly string[];
  readonly governancePolicy: GenesisGovernancePolicy;
  readonly feePolicy: string;
  readonly nativeAssetRegistry: readonly NativeAssetCandidate[];
  readonly allocationManifestReference: string;
  readonly securityEvidenceBundleHash: string | null;
  readonly rootOfTrustCeremony: CeremonyBinding;
  readonly status: CandidateStatus;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
  readonly environment: 'simulation';
};

export type GenesisGovernancePolicy = {
  readonly thresholdModel: 'VALIDATOR_SUPERMAJORITY';
  readonly requiredPower: bigint;
  readonly totalPower: bigint;
  readonly minActivationLead: number;
  readonly automaticBinaryUpgrade: false;
  readonly governanceToken: false;
  readonly aiMayGovern: false;
};

export type NativeAssetCandidate = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly genesisSupply: bigint;
  readonly faucetAllocation: 0n;
  readonly circulationLabel: 'PRODUCTION_ALLOCATION_NOT_AUTHORIZED';
};

export type ActivationPlanStep = {
  readonly order: number;
  readonly id: string;
  readonly title: string;
  readonly status: 'PLANNED';
  readonly executesInfrastructure: false;
  readonly notes: string;
};

export type ActivationPlan = {
  readonly schemaVersion: 1;
  readonly generatedAtUtc: string;
  readonly executes: false;
  readonly launchesValidators: false;
  readonly publishesGenesis: false;
  readonly enablesLiveFlags: false;
  readonly migratesCustomerFunds: false;
  readonly opensExchangeTrading: false;
  readonly enablesCustodyWithdrawals: false;
  readonly steps: readonly ActivationPlanStep[];
  readonly incompleteEvidence: readonly string[];
};

export type DimensionStatus = {
  readonly dimension: MainnetReadinessDimension;
  readonly status: EvidenceState;
  readonly requirementCount: number;
  readonly missing: readonly string[];
};

export type MainnetReadinessReport = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof MAINNET_READINESS_TOOL_VERSION;
  readonly overallEngineeringStatus: ReadinessEvaluatorStatus;
  readonly perDimension: readonly DimensionStatus[];
  readonly perCapability: readonly ProductionCapabilityActivation[];
  readonly missingExternalEvidence: readonly string[];
  readonly openSecurityFindings: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly testnetRcReference: TestnetReleaseCandidateSlot;
  readonly economicRcReference: EconomicReleaseCandidateSlot;
  readonly mainnetRcReference: MainnetReleaseCandidateSlot;
  readonly formalEvidence: FormalAssuranceSlot;
  readonly exchangeReadiness: ExchangeReadinessSlot;
  readonly custodyReadiness: CustodyReadinessSlot;
  readonly oracleReadiness: OracleReadinessSlot;
  readonly interopReadiness: InteropReadinessSlot;
  readonly privacyReadiness: PrivacyReadinessSlot;
  readonly pqcStatus: string;
  readonly supplyChainStatus: string;
  readonly disasterRecoveryStatus: string;
  readonly rootOfTrustStatus: string;
  readonly candidateGenesisHash: string | null;
  readonly liveFlagsRemainDisabled: true;
  readonly productionServicesActivated: false;
  readonly distinctions: readonly string[];
  readonly infrastructureReadinessDigest: string | null;
};

export type MainnetReadinessRegistry = {
  readonly schemaVersion: 1;
  readonly records: readonly ReadinessEvidenceRecord[];
  readonly authorizations: readonly MainnetAuthorizationRecord[];
  readonly capabilities: readonly ProductionCapabilityActivation[];
  readonly candidate: ProductionNetworkCandidate;
  readonly status: ReadinessEvaluatorStatus;
  readonly genesisHash: string;
  readonly infrastructureReadinessDigest: string | null;
};

export type ReadinessBundle = {
  readonly bundleHash: string;
  readonly signature: {
    readonly artifactDigest: string;
    readonly publicKeyHex: string;
    readonly signatureHex: string;
    readonly suiteId: string;
    readonly authorityId: string;
  };
  readonly report: MainnetReadinessReport;
};
