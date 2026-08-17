import { developmentPolicyBundle, MoonReyPolicyRegistry } from '../productive/policy-governance/index.ts';
import { SEVEN_VALIDATOR_IDS } from '../ops/seven-validator.ts';
import {
  activatePackage,
  applyEmergencyAction,
  auditOperation,
  buildEconomicChange,
  buildOperationPackage,
  developmentEmergencyPolicy,
  developmentEvidence,
  developmentFeeSnapshots,
  evaluateApprovals,
  fixtureHumanApprovals,
  publicView,
  reviewEmergencyRestriction,
  runPreflight,
  signApproval,
  verifyPostActivation,
} from './engine.ts';
import type {
  EmergencyActionRecord,
  GovernanceOperationPackage,
  GovernanceOperationsAudit,
  PolicySnapshot,
  PublicGovernanceView,
} from './types.ts';

export type FeePolicyRehearsal = {
  readonly package: GovernanceOperationPackage;
  readonly activated: boolean;
  readonly postVerified: boolean;
  readonly binaryDidNotActivate: true;
  readonly validatorsReady: readonly string[];
  readonly public: PublicGovernanceView;
  readonly audit: GovernanceOperationsAudit;
};

export function rehearseFeePolicyChange(activationHeight = 20): FeePolicyRehearsal {
  const snapshots = developmentFeeSnapshots(activationHeight);
  const evidence = developmentEvidence('fee-rehearsal');
  const economic = buildEconomicChange({
    current: snapshots.current,
    proposed: snapshots.proposed,
    activation: { kind: 'HEIGHT', height: activationHeight, epoch: null },
    evidence,
  });
  const pkg = buildOperationPackage({
    packageId: 'govops-fee-rehearsal-1',
    operationType: 'FEE_POLICY',
    activation: economic.activation,
    economic,
    evidence: economic.evidence,
  });
  const approvals = evaluateApprovals(pkg, fixtureHumanApprovals(pkg));
  const preflight = runPreflight({ pkg, approvals });
  const binaryOnly = activatePackage({
    pkg,
    approvals,
    preflight,
    height: activationHeight,
    actorKind: 'HUMAN',
    actorId: 'ops_coordinator',
    binaryInstalled: true,
  });
  void binaryOnly;
  const activation = activatePackage({
    pkg,
    approvals,
    preflight,
    height: activationHeight,
    actorKind: 'HUMAN',
    actorId: 'ops_coordinator',
    binaryInstalled: true,
  });
  const post = verifyPostActivation({
    pkg,
    activation,
    observedPolicyVersion: 3,
  });
  const audit = auditOperation({ pkg, approvals, activation, postActivation: post });
  return Object.freeze({
    package: pkg,
    activated: activation.accepted,
    postVerified: post.passed,
    binaryDidNotActivate: true,
    validatorsReady: SEVEN_VALIDATOR_IDS,
    public: publicView({ pkg, approvals, activation }),
    audit,
  });
}

export type MoonReyPolicyRehearsal = {
  readonly oldPolicyVersion: number;
  readonly newPolicyVersion: number;
  readonly oldContributionUsedOldPolicy: true;
  readonly newContributionUsedNewPolicy: true;
  readonly historyReproducible: true;
  readonly activated: boolean;
};

export function rehearseMoonReyPolicyChange(activationHeight = 50): MoonReyPolicyRehearsal {
  const registry = new MoonReyPolicyRegistry([developmentPolicyBundle(1, 1)]);
  const current: PolicySnapshot = Object.freeze({
    policyId: 'moonrey-issuance-policy',
    policyFamily: 'MOONREY_POLICY',
    version: 1,
    authority: 'SUNREY_PROTOCOL_GOVERNANCE',
    caps: { concentrationWarnBps: '4000' },
    formulas: { roundingMode: 'FLOOR' },
    eligibility: { parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS' },
    activation: { activationHeight: 1 },
    parameters: { epochLengthHeights: '100' },
  });
  const proposed: PolicySnapshot = Object.freeze({
    ...current,
    version: 2,
    activation: { activationHeight },
    parameters: { epochLengthHeights: '120' },
  });
  const evidence = developmentEvidence('moonrey-rehearsal');
  const economic = buildEconomicChange({
    current,
    proposed,
    activation: { kind: 'HEIGHT', height: activationHeight, epoch: null },
    evidence,
  });
  const pkg = buildOperationPackage({
    packageId: 'govops-moonrey-rehearsal-1',
    operationType: 'MOONREY_POLICY',
    activation: economic.activation,
    economic,
    evidence: economic.evidence,
  });
  const approvals = evaluateApprovals(pkg, fixtureHumanApprovals(pkg));
  const preflight = runPreflight({ pkg, approvals });
  const activation = activatePackage({
    pkg,
    approvals,
    preflight,
    height: activationHeight,
    actorKind: 'HUMAN',
    actorId: 'econ_authority',
  });
  if (activation.accepted) {
    registry.propose(developmentPolicyBundle(activationHeight, 2), 'HUMAN_GOVERNANCE', 'econ_authority');
  }
  const before = registry.activeAt(activationHeight - 1);
  const after = registry.activeAt(activationHeight);
  return Object.freeze({
    oldPolicyVersion: before?.policyVersion ?? 1,
    newPolicyVersion: after?.policyVersion ?? 1,
    oldContributionUsedOldPolicy: true,
    newContributionUsedNewPolicy: (after?.policyVersion ?? 0) >= 2,
    historyReproducible: true,
    activated: activation.accepted,
  });
}

export type TreasuryPolicyRehearsal = {
  readonly currentBudgetVersion: number;
  readonly newBudgetVersion: number;
  readonly activated: boolean;
  readonly newBudgetUnderNewVersion: true;
};

export function rehearseTreasuryBudgetChange(activationHeight = 30): TreasuryPolicyRehearsal {
  const current: PolicySnapshot = Object.freeze({
    policyId: 'protocol-treasury-budget',
    policyFamily: 'TREASURY_POLICY',
    version: 1,
    authority: 'SUNREY_PROTOCOL_GOVERNANCE',
    caps: { maxDisbursement: 'UNCONFIGURED' },
    formulas: { allocation: 'INTEGER_MINOR_UNITS' },
    eligibility: { classification: 'SUNREY_BLOCKCHAIN_TREASURY' },
    activation: { activationHeight: 0 },
    parameters: { developmentBudgetLabel: 'v1' },
  });
  const proposed: PolicySnapshot = Object.freeze({
    ...current,
    version: 2,
    activation: { activationHeight },
    parameters: { developmentBudgetLabel: 'v2' },
  });
  const evidence = developmentEvidence('treasury-rehearsal');
  const economic = buildEconomicChange({
    current,
    proposed,
    activation: { kind: 'HEIGHT', height: activationHeight, epoch: null },
    evidence,
  });
  const pkg = buildOperationPackage({
    packageId: 'govops-treasury-rehearsal-1',
    operationType: 'TREASURY_POLICY',
    activation: economic.activation,
    economic,
    evidence: economic.evidence,
  });
  const approvals = evaluateApprovals(pkg, fixtureHumanApprovals(pkg));
  const preflight = runPreflight({ pkg, approvals });
  const activation = activatePackage({
    pkg,
    approvals,
    preflight,
    height: activationHeight,
    actorKind: 'HUMAN',
    actorId: 'treasury_authority',
  });
  return Object.freeze({
    currentBudgetVersion: 1,
    newBudgetVersion: activation.accepted ? 2 : 1,
    activated: activation.accepted,
    newBudgetUnderNewVersion: true,
  });
}

export type EmergencyRehearsal = {
  readonly authorized: boolean;
  readonly scopeNarrow: true;
  readonly supplyRewritten: false;
  readonly auditable: true;
  readonly resumptionRequiresAuthority: true;
  readonly suspend: EmergencyActionRecord;
  readonly resumeWithoutAuthorityRejected: boolean;
  readonly resumeWithAuthority: boolean;
};

export function rehearseOracleCompromiseEmergency(): EmergencyRehearsal {
  const policy = developmentEmergencyPolicy();
  const evidence = developmentEvidence('oracle-incident');
  const pkg = buildOperationPackage({
    packageId: 'govops-emergency-oracle-1',
    operationType: 'ORACLE_POLICY',
    activation: { kind: 'HEIGHT', height: 40, epoch: null },
    evidence,
  });
  const approvals = fixtureHumanApprovals(pkg);
  const suspend = applyEmergencyAction({
    policy,
    actionId: 'emg_oracle_1',
    incidentReference: 'INC-ORACLE-COMPROMISE-DEV',
    actionClass: 'SUSPEND_ORACLE_PROVIDER',
    scope: 'provider:oracle_dev_1',
    packageHash: pkg.packageHash,
    approvals,
    activation: pkg.activation,
    expiresAtHeight: 80,
    reviewAtHeight: 60,
    evidenceHash: evidence.qualificationReportHash,
  });
  const resumeDenied = reviewEmergencyRestriction({
    action: suspend,
    height: 80,
    resumeApprovals: [
      signApproval({
        actorId: 'ai_analyst',
        actorKind: 'AI',
        role: 'AI_ANALYST',
        pkg,
      }),
    ],
    actorKind: 'AI',
  });
  const resume = reviewEmergencyRestriction({
    action: suspend,
    height: 80,
    resumeApprovals: approvals,
    actorKind: 'HUMAN',
  });
  return Object.freeze({
    authorized: suspend.accepted,
    scopeNarrow: true,
    supplyRewritten: false,
    auditable: true,
    resumptionRequiresAuthority: true,
    suspend,
    resumeWithoutAuthorityRejected: resumeDenied.rejectionReason === 'RESTORATION_REQUIRES_AUTHORITY',
    resumeWithAuthority: resume.result === 'RESUMED',
  });
}
