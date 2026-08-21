import { diffPolicySnapshots, assertUntamperedDiff } from './diff.ts';
import {
  commitGovernance,
  containsPrivateKeyMaterial,
  ed25519FromSeed,
  seedFromLabel,
  sha256Hex,
  signHex,
  verifyHex,
} from './hash.ts';
import {
  EMERGENCY_ACTION_CLASSES,
  FORBIDDEN_EMERGENCY_POWERS,
  GOVERNANCE_OPS_SCHEMA_VERSION,
  HUMAN_APPROVAL_ROLES,
  type ActivationCoordinate,
  type EconomicPolicyChangePackage,
  type EconomicReleaseCandidateBinding,
  type EmergencyActionClass,
  type EmergencyActionRecord,
  type EmergencyAuthorityPolicy,
  type GovernanceActivationRecord,
  type GovernanceApprovalRecord,
  type GovernanceApprovalSet,
  type GovernanceEvidenceBundle,
  type GovernanceNetworkClass,
  type GovernanceOfflinePackage,
  type GovernanceOperationPackage,
  type GovernanceOperationType,
  type GovernanceOperationsAudit,
  type GovernanceOpsActorKind,
  type GovernanceOpsRole,
  type GovernancePostActivationReport,
  type GovernancePreflightCheck,
  type GovernancePreflightReport,
  type HumanApprovalRole,
  type PolicySnapshot,
  type PublicGovernanceView,
  type RestrictionState,
} from './types.ts';

export const DEVELOPMENT_NETWORK_ID = 'sunrey-dev-1';
export const DEVELOPMENT_CHAIN_ID = 'sunrey-dev-chain-1';
export const PRODUCTION_CANDIDATE_NETWORK_ID = 'sunrey-production-candidate-1';

const HIGH_IMPACT_TYPES: readonly GovernanceOperationType[] = [
  'MONETARY_POLICY',
  'FEE_POLICY',
  'VALIDATOR_ECONOMICS',
  'MOONREY_POLICY',
  'TREASURY_POLICY',
  'PROTOCOL_UPGRADE',
];

export function developmentEvidence(label = 'dev-evidence'): GovernanceEvidenceBundle {
  const digest = (suffix: string) => sha256Hex(`govops-evidence|${label}|${suffix}`);
  return Object.freeze({
    schemaHash: digest('schema'),
    formalReportHash: digest('formal'),
    propertyTestHash: digest('property'),
    economicStressReportHash: digest('stress'),
    simulationEvidenceHash: digest('simulation'),
    qualificationReportHash: digest('qualification'),
    readinessEvidenceHash: digest('readiness'),
    releaseArtifactHash: digest('release'),
    economicReleaseCandidateHash: digest('economic-rc'),
    supplyInvariantHash: digest('supply'),
  });
}

export function bindEconomicReleaseCandidate(evidence: GovernanceEvidenceBundle): EconomicReleaseCandidateBinding {
  const draft = {
    domain: 'sunrey.governance.economic-rc.v1' as const,
    releaseArtifactHash: evidence.releaseArtifactHash,
    formalReportHash: evidence.formalReportHash,
    economicStressReportHash: evidence.economicStressReportHash,
    qualificationReportHash: evidence.qualificationReportHash,
  };
  return Object.freeze({
    ...draft,
    economicReleaseCandidateHash: commitGovernance(draft),
  });
}

export function evidenceFromEconomicReleaseCandidate(input: {
  readonly economicRcId: string;
  readonly sourceCommit: string;
  readonly releaseArtifactHash: string;
  readonly formalReportHash: string;
  readonly economicStressReportHash: string;
  readonly qualificationReportHash: string;
  readonly simulationEvidenceHash: string;
  readonly supplyInvariantHash: string;
  readonly schemaHash: string;
  readonly propertyTestHash?: string;
  readonly readinessEvidenceHash?: string;
}): GovernanceEvidenceBundle {
  return Object.freeze({
    schemaHash: input.schemaHash,
    formalReportHash: input.formalReportHash,
    propertyTestHash: input.propertyTestHash ?? sha256Hex(`govops-property|${input.economicRcId}`),
    economicStressReportHash: input.economicStressReportHash,
    simulationEvidenceHash: input.simulationEvidenceHash,
    qualificationReportHash: input.qualificationReportHash,
    readinessEvidenceHash: input.readinessEvidenceHash ?? sha256Hex(`govops-readiness|${input.sourceCommit}`),
    releaseArtifactHash: input.releaseArtifactHash,
    economicReleaseCandidateHash: sha256Hex(`govops-economic-rc|${input.economicRcId}|${input.sourceCommit}`),
    supplyInvariantHash: input.supplyInvariantHash,
  });
}

export function bindCanonicalEconomicReleaseCandidate(input: {
  readonly economicRcId: string;
  readonly sourceCommit: string;
  readonly releaseArtifactHash: string;
  readonly formalReportHash: string;
  readonly economicStressReportHash: string;
  readonly qualificationReportHash: string;
  readonly simulationEvidenceHash: string;
  readonly supplyInvariantHash: string;
  readonly schemaHash: string;
}): EconomicReleaseCandidateBinding {
  return bindEconomicReleaseCandidate(evidenceFromEconomicReleaseCandidate(input));
}

export function developmentFeeSnapshots(activationHeight: number): {
  readonly current: PolicySnapshot;
  readonly proposed: PolicySnapshot;
} {
  const current: PolicySnapshot = Object.freeze({
    policyId: 'fee-policy-v2',
    policyFamily: 'FEE_POLICY',
    version: 2,
    authority: 'SUNREY_PROTOCOL_GOVERNANCE',
    caps: { minimumFee: '100', maxBasePrice: '10000' },
    formulas: { formulaVersion: 'BASE_PRICE_FORMULA_V1' },
    eligibility: { feeAsset: 'SUNREY_COIN', moonreyFeeEnabled: false },
    activation: { activationHeight: 0, productionParametersConfigured: false },
    parameters: { priorityEnabled: true, developmentMinFeeBump: '0' },
  });
  const proposed: PolicySnapshot = Object.freeze({
    ...current,
    version: 3,
    activation: { activationHeight, productionParametersConfigured: false },
    parameters: { priorityEnabled: true, developmentMinFeeBump: '1' },
  });
  return { current, proposed };
}

export function packageHashOf(
  pkg: Omit<GovernanceOperationPackage, 'packageHash' | 'status'> & { readonly status?: GovernanceOperationPackage['status'] },
): string {
  const { packageHash: _ignored, status: _status, ...rest } = pkg as GovernanceOperationPackage;
  void _ignored;
  void _status;
  return commitGovernance(rest);
}

export function buildEconomicChange(input: {
  readonly current: PolicySnapshot;
  readonly proposed: PolicySnapshot;
  readonly activation: ActivationCoordinate;
  readonly evidence: GovernanceEvidenceBundle;
}): EconomicPolicyChangePackage {
  const canonicalDiff = diffPolicySnapshots(input.current, input.proposed);
  const binding = bindEconomicReleaseCandidate(input.evidence);
  return Object.freeze({
    targetPolicy: input.proposed.policyFamily,
    currentVersion: input.current.version,
    proposedVersion: input.proposed.version,
    currentSnapshot: input.current,
    proposedSnapshot: input.proposed,
    canonicalDiff,
    activation: input.activation,
    evidence: {
      ...input.evidence,
      economicReleaseCandidateHash: binding.economicReleaseCandidateHash,
    },
    releaseCandidateHash: binding.economicReleaseCandidateHash,
  });
}

export function buildOperationPackage(input: {
  readonly packageId: string;
  readonly operationType: GovernanceOperationType;
  readonly networkId?: string;
  readonly chainId?: string;
  readonly networkClass?: GovernanceNetworkClass;
  readonly currentProtocolVersion?: number;
  readonly targetProtocolVersion?: number;
  readonly activation: ActivationCoordinate;
  readonly approvalValidFromUtc?: string;
  readonly approvalValidUntilUtc?: string;
  readonly economic?: EconomicPolicyChangePackage | null;
  readonly evidence?: GovernanceEvidenceBundle;
  readonly upgradePlanHash?: string | null;
}): GovernanceOperationPackage {
  const evidence = input.evidence ?? developmentEvidence(input.packageId);
  const draft = {
    schemaVersion: GOVERNANCE_OPS_SCHEMA_VERSION,
    packageId: input.packageId,
    operationType: input.operationType,
    networkId: input.networkId ?? DEVELOPMENT_NETWORK_ID,
    chainId: input.chainId ?? DEVELOPMENT_CHAIN_ID,
    networkClass: input.networkClass ?? 'DEVELOPMENT',
    protocolGovernanceReference: 'CHUNK_40_UPGRADE_PLAN' as const,
    replacesConsensusGovernance: false as const,
    governanceToken: false as const,
    aiMayVote: false as const,
    mayRewriteFinalizedHistory: false as const,
    currentProtocolVersion: input.currentProtocolVersion ?? 1,
    targetProtocolVersion: input.targetProtocolVersion ?? 1,
    activation: input.activation,
    approvalValidFromUtc: input.approvalValidFromUtc ?? '2026-08-17T00:00:00.000Z',
    approvalValidUntilUtc: input.approvalValidUntilUtc ?? '2026-12-31T00:00:00.000Z',
    economic: input.economic ?? null,
    evidence,
    upgradePlanHash: input.upgradePlanHash ?? null,
  };
  return Object.freeze({
    ...draft,
    packageHash: commitGovernance(draft),
    status: 'PACKAGED' as const,
  });
}

export function requiredRolesFor(type: GovernanceOperationType): readonly HumanApprovalRole[] {
  if (type === 'FEE_POLICY' || type === 'MONETARY_POLICY' || type === 'MOONREY_POLICY' || type === 'TREASURY_POLICY') {
    return ['PROTOCOL_AUTHORITY', 'ECONOMIC_POLICY_AUTHORITY', 'SECURITY_AUTHORITY'];
  }
  if (type === 'VALIDATOR_ECONOMICS' || type === 'VALIDATOR_SET') {
    return ['PROTOCOL_AUTHORITY', 'VALIDATOR_GOVERNANCE_AUTHORITY', 'SECURITY_AUTHORITY'];
  }
  return ['PROTOCOL_AUTHORITY', 'SECURITY_AUTHORITY', 'RELEASE_AUTHORITY'];
}

export function approvalPayload(input: {
  readonly packageHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly policyVersion: number;
  readonly activationHeight: number;
  readonly role: GovernanceOpsRole;
  readonly actorId: string;
}): string {
  return commitGovernance({
    kind: 'GOVERNANCE_APPROVAL',
    ...input,
  });
}

export function signApproval(input: {
  readonly actorId: string;
  readonly actorKind: GovernanceOpsActorKind;
  readonly role: GovernanceOpsRole;
  readonly pkg: GovernanceOperationPackage;
  readonly signedAtUtc?: string;
}): GovernanceApprovalRecord {
  const policyVersion = input.pkg.economic?.proposedVersion ?? input.pkg.targetProtocolVersion;
  const payload = approvalPayload({
    packageHash: input.pkg.packageHash,
    networkId: input.pkg.networkId,
    chainId: input.pkg.chainId,
    policyVersion,
    activationHeight: input.pkg.activation.height,
    role: input.role,
    actorId: input.actorId,
  });
  const seed = seedFromLabel(input.actorId);
  const keys = ed25519FromSeed(seed);
  const ai = input.actorKind !== 'HUMAN' || input.role === 'AI_ANALYST';
  if (ai) {
    return Object.freeze({
      actorId: input.actorId,
      actorKind: input.actorKind,
      role: input.role,
      packageHash: input.pkg.packageHash,
      networkId: input.pkg.networkId,
      chainId: input.pkg.chainId,
      policyVersion,
      activationHeight: input.pkg.activation.height,
      signedAtUtc: input.signedAtUtc ?? '2026-08-17T00:00:00.000Z',
      publicKeyHex: keys.publicKeyHex,
      signatureHex: '',
      accepted: false,
      rejectionReason: 'AI_CANNOT_AUTHORIZE',
    });
  }
  return Object.freeze({
    actorId: input.actorId,
    actorKind: input.actorKind,
    role: input.role,
    packageHash: input.pkg.packageHash,
    networkId: input.pkg.networkId,
    chainId: input.pkg.chainId,
    policyVersion,
    activationHeight: input.pkg.activation.height,
    signedAtUtc: input.signedAtUtc ?? '2026-08-17T00:00:00.000Z',
    publicKeyHex: keys.publicKeyHex,
    signatureHex: signHex(seed, payload),
    accepted: true,
    rejectionReason: null,
  });
}

export function evaluateApprovals(
  pkg: GovernanceOperationPackage,
  records: readonly GovernanceApprovalRecord[],
  nowUtc = '2026-08-17T12:00:00.000Z',
): GovernanceApprovalSet {
  const required = requiredRolesFor(pkg.operationType);
  const accepted = records.filter((record) => {
    if (!record.accepted) {
      return false;
    }
    if (record.actorKind !== 'HUMAN' || record.role === 'AI_ANALYST') {
      return false;
    }
    if (record.packageHash !== pkg.packageHash) {
      return false;
    }
    if (record.networkId !== pkg.networkId || record.chainId !== pkg.chainId) {
      return false;
    }
    if (record.activationHeight !== pkg.activation.height) {
      return false;
    }
    const payload = approvalPayload({
      packageHash: record.packageHash,
      networkId: record.networkId,
      chainId: record.chainId,
      policyVersion: record.policyVersion,
      activationHeight: record.activationHeight,
      role: record.role,
      actorId: record.actorId,
    });
    return verifyHex(record.publicKeyHex, payload, record.signatureHex);
  });
  const roles = new Set(accepted.map((record) => record.role));
  const actors = new Set(accepted.map((record) => record.actorId));
  const minimumDistinctActors = HIGH_IMPACT_TYPES.includes(pkg.operationType) ? 2 : 1;
  const windowOk = nowUtc >= pkg.approvalValidFromUtc && nowUtc <= pkg.approvalValidUntilUtc;
  const satisfied =
    windowOk &&
    required.every((role) => roles.has(role)) &&
    actors.size >= minimumDistinctActors &&
    !accepted.some((record) => record.role === 'AI_ANALYST');
  return Object.freeze({
    requiredRoles: required,
    minimumDistinctActors,
    records,
    satisfied,
  });
}

export function runPreflight(input: {
  readonly pkg: GovernanceOperationPackage;
  readonly expectedNetworkId?: string;
  readonly expectedNetworkClass?: GovernanceNetworkClass;
  readonly expectedEconomicRcHash?: string;
  readonly expectedReleaseHash?: string;
  readonly nowUtc?: string;
  readonly approvals?: GovernanceApprovalSet;
  readonly schemaValid?: boolean;
  readonly formalSmoke?: boolean;
  readonly propertyTests?: boolean;
  readonly economicStress?: boolean;
  readonly simulation?: boolean;
  readonly compatibility?: boolean;
  readonly supplyInvariants?: boolean;
}): GovernancePreflightReport {
  const pkg = input.pkg;
  const nowUtc = input.nowUtc ?? '2026-08-17T12:00:00.000Z';
  const expectedNetwork = input.expectedNetworkId ?? pkg.networkId;
  const expectedClass = input.expectedNetworkClass ?? pkg.networkClass;
  const expectedRc = input.expectedEconomicRcHash ?? pkg.evidence.economicReleaseCandidateHash;
  const expectedRelease = input.expectedReleaseHash ?? pkg.evidence.releaseArtifactHash;
  const checks: GovernancePreflightCheck[] = [
    {
      id: 'SCHEMA_VALIDATION',
      passed: input.schemaValid !== false && pkg.schemaVersion === 1 && pkg.governanceToken === false,
      detail: 'package schema and no-governance-token invariant',
    },
    {
      id: 'FORMAL_SMOKE',
      passed: input.formalSmoke !== false,
      detail: 'GOVERNANCE_OPERATION_SAFETY and bound economic models',
    },
    {
      id: 'PROPERTY_TESTS',
      passed: input.propertyTests !== false,
      detail: 'engineering property tests',
    },
    {
      id: 'ECONOMIC_STRESS',
      passed: input.economicStress !== false && pkg.evidence.economicStressReportHash.length === 64,
      detail: 'bound economic stress report',
    },
    {
      id: 'SIMULATION',
      passed: input.simulation !== false,
      detail: 'simulation evidence present',
    },
    {
      id: 'COMPATIBILITY',
      passed: input.compatibility !== false,
      detail: 'node and explorer compatibility',
    },
    {
      id: 'RELEASE_ARTIFACT',
      passed: pkg.evidence.releaseArtifactHash === expectedRelease,
      detail: pkg.evidence.releaseArtifactHash === expectedRelease ? 'release hash bound' : 'WRONG_RELEASE_HASH',
    },
    {
      id: 'SUPPLY_INVARIANTS',
      passed: input.supplyInvariants !== false && pkg.mayRewriteFinalizedHistory === false,
      detail: 'no supply rewrite and no history rewrite',
    },
    {
      id: 'PACKAGE_HASH',
      passed: packageHashOf(pkg) === pkg.packageHash,
      detail: packageHashOf(pkg) === pkg.packageHash ? 'package hash intact' : 'TAMPERED_PACKAGE',
    },
    {
      id: 'NETWORK',
      passed: pkg.networkId === expectedNetwork && pkg.networkClass === expectedClass,
      detail:
        pkg.networkId === expectedNetwork && pkg.networkClass === expectedClass
          ? 'network binding intact'
          : 'WRONG_NETWORK',
    },
    {
      id: 'APPROVAL_WINDOW',
      passed: nowUtc >= pkg.approvalValidFromUtc && nowUtc <= pkg.approvalValidUntilUtc,
      detail:
        nowUtc >= pkg.approvalValidFromUtc && nowUtc <= pkg.approvalValidUntilUtc
          ? 'approval window open'
          : 'EXPIRED_PACKAGE',
    },
    {
      id: 'ECONOMIC_RC',
      passed: !pkg.economic || pkg.economic.releaseCandidateHash === expectedRc,
      detail: !pkg.economic || pkg.economic.releaseCandidateHash === expectedRc ? 'economic RC bound' : 'WRONG_ECONOMIC_RC',
    },
  ];
  if (pkg.economic) {
    const intact = assertUntamperedDiff(
      pkg.economic.currentSnapshot,
      pkg.economic.proposedSnapshot,
      pkg.economic.canonicalDiff,
    );
    checks.push({
      id: 'SCHEMA_VALIDATION',
      passed: intact,
      detail: intact ? 'canonical diff matches snapshots' : 'TAMPERED_POLICY_DIFF',
    });
  }
  return Object.freeze({
    packageHash: pkg.packageHash,
    networkId: pkg.networkId,
    chainId: pkg.chainId,
    checks,
    passed: checks.every((check) => check.passed),
    binaryInstallActivatesPolicy: false,
  });
}

export function activatePackage(input: {
  readonly pkg: GovernanceOperationPackage;
  readonly approvals: GovernanceApprovalSet;
  readonly preflight: GovernancePreflightReport;
  readonly height: number;
  readonly actorKind: GovernanceOpsActorKind;
  readonly actorId: string;
  readonly binaryInstalled?: boolean;
}): GovernanceActivationRecord {
  if (input.actorKind !== 'HUMAN') {
    return Object.freeze({
      packageHash: input.pkg.packageHash,
      activation: input.pkg.activation,
      activatedAtHeight: null,
      binaryInstalled: input.binaryInstalled === true,
      policyActivated: false,
      actorKind: input.actorKind,
      actorId: input.actorId,
      accepted: false,
      rejectionReason: 'AI_CANNOT_AUTHORIZE',
    });
  }
  if (!input.approvals.satisfied) {
    return Object.freeze({
      packageHash: input.pkg.packageHash,
      activation: input.pkg.activation,
      activatedAtHeight: null,
      binaryInstalled: input.binaryInstalled === true,
      policyActivated: false,
      actorKind: input.actorKind,
      actorId: input.actorId,
      accepted: false,
      rejectionReason: 'INSUFFICIENT_APPROVAL',
    });
  }
  if (!input.preflight.passed) {
    return Object.freeze({
      packageHash: input.pkg.packageHash,
      activation: input.pkg.activation,
      activatedAtHeight: null,
      binaryInstalled: input.binaryInstalled === true,
      policyActivated: false,
      actorKind: input.actorKind,
      actorId: input.actorId,
      accepted: false,
      rejectionReason: 'PREFLIGHT_FAILED',
    });
  }
  if (packageHashOf(input.pkg) !== input.pkg.packageHash) {
    return Object.freeze({
      packageHash: input.pkg.packageHash,
      activation: input.pkg.activation,
      activatedAtHeight: null,
      binaryInstalled: input.binaryInstalled === true,
      policyActivated: false,
      actorKind: input.actorKind,
      actorId: input.actorId,
      accepted: false,
      rejectionReason: 'WRONG_PACKAGE_HASH',
    });
  }
  if (input.height < input.pkg.activation.height) {
    return Object.freeze({
      packageHash: input.pkg.packageHash,
      activation: input.pkg.activation,
      activatedAtHeight: null,
      binaryInstalled: input.binaryInstalled === true,
      policyActivated: false,
      actorKind: input.actorKind,
      actorId: input.actorId,
      accepted: false,
      rejectionReason: 'ACTIVATION_NOT_BEFORE_COORDINATE',
    });
  }
  return Object.freeze({
    packageHash: input.pkg.packageHash,
    activation: input.pkg.activation,
    activatedAtHeight: input.height,
    binaryInstalled: input.binaryInstalled === true,
    policyActivated: true,
    actorKind: input.actorKind,
    actorId: input.actorId,
    accepted: true,
    rejectionReason: null,
  });
}

export function verifyPostActivation(input: {
  readonly pkg: GovernanceOperationPackage;
  readonly activation: GovernanceActivationRecord;
  readonly observedPolicyVersion: number;
  readonly stateRootAgreement?: boolean;
  readonly nativeSupplyUnchangedExceptGoverned?: boolean;
  readonly feeBehaviorMatchesPolicy?: boolean;
  readonly validatorEconomicsMatchPolicy?: boolean;
  readonly moonreyIssuanceMatchesPolicy?: boolean;
  readonly treasuryBehaviorMatchesPolicy?: boolean;
  readonly explorerCompatible?: boolean;
}): GovernancePostActivationReport {
  const expectedVersion = input.pkg.economic?.proposedVersion ?? input.pkg.targetProtocolVersion;
  const passed =
    input.activation.accepted &&
    input.activation.policyActivated &&
    input.observedPolicyVersion === expectedVersion &&
    input.stateRootAgreement !== false &&
    input.nativeSupplyUnchangedExceptGoverned !== false &&
    input.feeBehaviorMatchesPolicy !== false &&
    input.validatorEconomicsMatchPolicy !== false &&
    input.moonreyIssuanceMatchesPolicy !== false &&
    input.treasuryBehaviorMatchesPolicy !== false &&
    input.explorerCompatible !== false;
  return Object.freeze({
    packageHash: input.pkg.packageHash,
    activePolicyVersion: input.observedPolicyVersion,
    stateRootAgreement: input.stateRootAgreement !== false,
    nativeSupplyUnchangedExceptGoverned: input.nativeSupplyUnchangedExceptGoverned !== false,
    feeBehaviorMatchesPolicy: input.feeBehaviorMatchesPolicy !== false,
    validatorEconomicsMatchPolicy: input.validatorEconomicsMatchPolicy !== false,
    moonreyIssuanceMatchesPolicy: input.moonreyIssuanceMatchesPolicy !== false,
    treasuryBehaviorMatchesPolicy: input.treasuryBehaviorMatchesPolicy !== false,
    explorerCompatible: input.explorerCompatible !== false,
    historyRewritten: false,
    passed,
  });
}

export function developmentEmergencyPolicy(): EmergencyAuthorityPolicy {
  return Object.freeze({
    policyId: 'emergency-authority-dev-1',
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    permittedClasses: EMERGENCY_ACTION_CLASSES,
    forbiddenPowers: FORBIDDEN_EMERGENCY_POWERS,
    requiredRoles: ['SECURITY_AUTHORITY', 'PROTOCOL_AUTHORITY'] as const,
    minimumDistinctActors: 2,
    aiCannotApprove: true,
    mayMintNativeAssets: false,
    mayRewriteSupply: false,
    mayRewriteFinalizedHistory: false,
  });
}

export function applyEmergencyAction(input: {
  readonly policy: EmergencyAuthorityPolicy;
  readonly actionId: string;
  readonly incidentReference: string;
  readonly actionClass: EmergencyActionClass | string;
  readonly scope: string;
  readonly packageHash: string;
  readonly approvals: readonly GovernanceApprovalRecord[];
  readonly activation: ActivationCoordinate;
  readonly expiresAtHeight?: number | null;
  readonly reviewAtHeight?: number | null;
  readonly evidenceHash: string;
  readonly requestedPower?: string;
}): EmergencyActionRecord {
  const permitted = (EMERGENCY_ACTION_CLASSES as readonly string[]).includes(input.actionClass);
  const forbidden = (FORBIDDEN_EMERGENCY_POWERS as readonly string[]).includes(input.requestedPower ?? '');
  const human = input.approvals.filter(
    (record) =>
      record.accepted &&
      record.actorKind === 'HUMAN' &&
      record.role !== 'AI_ANALYST' &&
      record.packageHash === input.packageHash,
  );
  const roles = new Set(human.map((record) => record.role));
  const actors = new Set(human.map((record) => record.actorId));
  const authorized =
    permitted &&
    !forbidden &&
    input.policy.requiredRoles.every((role) => roles.has(role)) &&
    actors.size >= input.policy.minimumDistinctActors;
  let rejection: string | null = null;
  if (!permitted) {
    rejection = 'EMERGENCY_OVERREACH';
  } else if (input.requestedPower === 'MINT_NATIVE_ASSETS') {
    rejection = 'EMERGENCY_CANNOT_MINT';
  } else if (input.requestedPower === 'REWRITE_SUPPLY') {
    rejection = 'EMERGENCY_SUPPLY_REWRITE';
  } else if (input.requestedPower === 'CONFISCATE_CUSTOMER_WALLETS') {
    rejection = 'EMERGENCY_CANNOT_CONFISCATE';
  } else if (input.requestedPower === 'REWRITE_FINALIZED_BLOCKS') {
    rejection = 'EMERGENCY_CANNOT_REWRITE_FINALIZED_HISTORY';
  } else if (forbidden) {
    rejection = 'EMERGENCY_OVERREACH';
  } else if (actors.size < input.policy.minimumDistinctActors || !input.policy.requiredRoles.every((role) => roles.has(role))) {
    rejection = 'INSUFFICIENT_APPROVAL';
  } else if (input.approvals.some((record) => record.actorKind !== 'HUMAN' && record.accepted)) {
    rejection = 'AI_CANNOT_AUTHORIZE';
  }
  return Object.freeze({
    actionId: input.actionId,
    incidentReference: input.incidentReference,
    actionClass: permitted ? (input.actionClass as EmergencyActionClass) : 'RESTRICT_SPECIFIC_PROTOCOL_FEATURE',
    scope: input.scope,
    authority: 'SECURITY_GOVERNANCE_AUTHORITY',
    packageHash: input.packageHash,
    approvals: Object.freeze({
      requiredRoles: input.policy.requiredRoles,
      minimumDistinctActors: input.policy.minimumDistinctActors,
      records: input.approvals,
      satisfied: authorized,
    }),
    activation: input.activation,
    expiresAtHeight: input.expiresAtHeight ?? null,
    reviewAtHeight: input.reviewAtHeight ?? null,
    evidenceHash: input.evidenceHash,
    result: authorized ? 'ACTIVE' : 'INACTIVE',
    accepted: authorized && rejection === null,
    rejectionReason: authorized ? null : rejection,
  });
}

export function reviewEmergencyRestriction(input: {
  readonly action: EmergencyActionRecord;
  readonly height: number;
  readonly resumeApprovals: readonly GovernanceApprovalRecord[];
  readonly actorKind: GovernanceOpsActorKind;
}): EmergencyActionRecord {
  if (input.action.expiresAtHeight !== null && input.height >= input.action.expiresAtHeight) {
    if (input.actorKind !== 'HUMAN' || input.resumeApprovals.filter((row) => row.accepted && row.actorKind === 'HUMAN').length < 2) {
      return Object.freeze({
        ...input.action,
        result: 'EXPIRED_AWAITING_AUTHORITY',
        accepted: false,
        rejectionReason: 'RESTORATION_REQUIRES_AUTHORITY',
      });
    }
  }
  const human = input.resumeApprovals.filter((row) => row.accepted && row.actorKind === 'HUMAN' && row.role !== 'AI_ANALYST');
  if (input.actorKind !== 'HUMAN' || human.length < 2) {
    return Object.freeze({
      ...input.action,
      result: 'PENDING_REVIEW',
      accepted: false,
      rejectionReason: 'RESTORATION_REQUIRES_AUTHORITY',
    });
  }
  return Object.freeze({
    ...input.action,
    result: 'RESUMED',
    accepted: true,
    rejectionReason: null,
  });
}

export function buildOfflinePackage(pkg: GovernanceOperationPackage, signatures: readonly string[]): GovernanceOfflinePackage {
  const payload = {
    policyHash: pkg.economic?.canonicalDiff.diffHash ?? pkg.packageHash,
    releaseHash: pkg.evidence.releaseArtifactHash,
    activation: pkg.activation,
    approvalRequest: `approve:${pkg.packageHash}`,
    publicSignatures: signatures,
  };
  if (containsPrivateKeyMaterial(payload)) {
    throw new TypeError('governance offline package cannot contain private keys');
  }
  return Object.freeze({
    kind: 'SUNREY_GOVERNANCE_OFFLINE_PACKAGE',
    packageKind: 'APPROVAL_REQUESTS',
    payload,
    payloadHash: commitGovernance(payload),
    containsPrivateKeys: false,
  });
}

export function auditOperation(input: {
  readonly pkg: GovernanceOperationPackage;
  readonly approvals: GovernanceApprovalSet;
  readonly activation: GovernanceActivationRecord | null;
  readonly postActivation: GovernancePostActivationReport | null;
  readonly emergencyActions?: readonly EmergencyActionRecord[];
}): GovernanceOperationsAudit {
  const findings: string[] = [];
  if (!input.approvals.satisfied) {
    findings.push('approvals incomplete');
  }
  if (input.activation && !input.activation.accepted) {
    findings.push(input.activation.rejectionReason ?? 'activation refused');
  }
  if (input.postActivation && !input.postActivation.passed) {
    findings.push('post-activation verification incomplete');
  }
  for (const action of input.emergencyActions ?? []) {
    if (!action.accepted) {
      findings.push(`emergency ${action.actionId}: ${action.rejectionReason ?? 'refused'}`);
    }
  }
  return Object.freeze({
    packageId: input.pkg.packageId,
    packageHash: input.pkg.packageHash,
    proposal: input.pkg,
    diff: input.pkg.economic?.canonicalDiff ?? null,
    evidence: input.pkg.evidence,
    approvals: input.approvals,
    releaseHash: input.pkg.evidence.releaseArtifactHash,
    activation: input.activation,
    postActivation: input.postActivation,
    emergencyActions: input.emergencyActions ?? [],
    openFindings: findings,
  });
}

export function publicView(input: {
  readonly pkg: GovernanceOperationPackage;
  readonly approvals: GovernanceApprovalSet;
  readonly activation: GovernanceActivationRecord | null;
  readonly emergency?: EmergencyActionRecord | null;
}): PublicGovernanceView {
  let approvalResult: PublicGovernanceView['approvalResult'] = 'PENDING';
  if (input.approvals.records.some((row) => row.rejectionReason === 'EXPIRED_PACKAGE')) {
    approvalResult = 'EXPIRED';
  } else if (input.approvals.satisfied) {
    approvalResult = 'APPROVED';
  } else if (input.approvals.records.some((row) => row.accepted === false && row.rejectionReason !== 'AI_CANNOT_AUTHORIZE')) {
    approvalResult = 'REJECTED';
  }
  return Object.freeze({
    proposalId: input.pkg.packageId,
    operationType: input.pkg.operationType,
    policyDiff: input.pkg.economic?.canonicalDiff ?? null,
    activationCoordinate: input.pkg.activation,
    approvalResult,
    activeVersion: input.activation?.accepted ? (input.pkg.economic?.proposedVersion ?? input.pkg.targetProtocolVersion) : null,
    emergencyRestrictionClass: input.emergency?.accepted ? input.emergency.actionClass : null,
    restrictionState: input.emergency?.result ?? 'INACTIVE',
  });
}

export function fixtureHumanApprovals(pkg: GovernanceOperationPackage): readonly GovernanceApprovalRecord[] {
  const roles = requiredRolesFor(pkg.operationType);
  return roles.map((role, index) =>
    signApproval({
      actorId: `human_${role.toLowerCase()}_${index + 1}`,
      actorKind: 'HUMAN',
      role,
      pkg,
    }),
  );
}

export function isHumanApprovalRole(role: GovernanceOpsRole): role is HumanApprovalRole {
  return (HUMAN_APPROVAL_ROLES as readonly string[]).includes(role);
}
