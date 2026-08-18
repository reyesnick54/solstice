import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createGovernanceOpsModel } from './formal/models/governance-ops.ts';
import { exploreModel } from './formal/explore.ts';
import {
  PRODUCTION_CANDIDATE_NETWORK_ID,
  activatePackage,
  applyEmergencyAction,
  bindEconomicReleaseCandidate,
  buildEconomicChange,
  buildOfflinePackage,
  buildOperationPackage,
  developmentEmergencyPolicy,
  developmentEvidence,
  developmentFeeSnapshots,
  evaluateApprovals,
  fixtureHumanApprovals,
  packageHashOf,
  reviewEmergencyRestriction,
  runPreflight,
  signApproval,
  verifyPostActivation,
} from './governance-ops/engine.ts';
import { runGovernanceOpsCommand } from './governance-ops/cli.ts';
import { diffPolicySnapshots } from './governance-ops/diff.ts';
import {
  rehearseFeePolicyChange,
  rehearseMoonReyPolicyChange,
  rehearseOracleCompromiseEmergency,
  rehearseTreasuryBudgetChange,
} from './governance-ops/rehearsals.ts';

function feePackage(overrides: Partial<Parameters<typeof buildOperationPackage>[0]> = {}) {
  const snapshots = developmentFeeSnapshots(20);
  const evidence = developmentEvidence('test-fee');
  const economic = buildEconomicChange({
    current: snapshots.current,
    proposed: snapshots.proposed,
    activation: { kind: 'HEIGHT', height: 20, epoch: null },
    evidence,
  });
  return buildOperationPackage({
    packageId: 'govops-test-fee',
    operationType: 'FEE_POLICY',
    activation: economic.activation,
    economic,
    evidence: economic.evidence,
    ...overrides,
  });
}

describe('SunRey production governance operations', () => {
  it('packages a fee-policy change with a canonical diff', () => {
    const pkg = feePackage();
    assert.equal(pkg.governanceToken, false);
    assert.equal(pkg.aiMayVote, false);
    assert.equal(pkg.mayRewriteFinalizedHistory, false);
    assert.equal(pkg.replacesConsensusGovernance, false);
    assert.equal(pkg.economic?.canonicalDiff.changedParameters.includes('developmentMinFeeBump'), true);
    assert.equal(packageHashOf(pkg), pkg.packageHash);
  });

  it('rejects a tampered policy diff', () => {
    const pkg = feePackage();
    const tampered = {
      ...pkg,
      economic: pkg.economic
        ? {
            ...pkg.economic,
            canonicalDiff: { ...pkg.economic.canonicalDiff, changedParameters: ['forged'] },
          }
        : null,
    };
    const preflight = runPreflight({ pkg: tampered as typeof pkg });
    assert.equal(preflight.checks.some((check) => check.detail === 'TAMPERED_POLICY_DIFF'), true);
    assert.equal(preflight.passed, false);
  });

  it('fails preflight on the wrong economic release hash', () => {
    const pkg = feePackage();
    const preflight = runPreflight({ pkg, expectedEconomicRcHash: '00'.repeat(32) });
    assert.equal(preflight.checks.some((check) => check.detail === 'WRONG_ECONOMIC_RC'), true);
  });

  it('rejects a replayed approval on a modified package', () => {
    const original = feePackage();
    const replayed = fixtureHumanApprovals(original);
    const modified = feePackage({ packageId: 'govops-test-fee-modified' });
    const approvals = evaluateApprovals(modified, replayed);
    assert.equal(approvals.satisfied, false);
    const activation = activatePackage({
      pkg: modified,
      approvals,
      preflight: runPreflight({ pkg: modified }),
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'operator',
    });
    assert.equal(activation.rejectionReason, 'INSUFFICIENT_APPROVAL');
  });

  it('rejects a testnet package on a production-candidate network', () => {
    const pkg = feePackage({ networkClass: 'TESTNET', networkId: 'sunrey-testnet-1' });
    const preflight = runPreflight({
      pkg,
      expectedNetworkId: PRODUCTION_CANDIDATE_NETWORK_ID,
      expectedNetworkClass: 'PRODUCTION_CANDIDATE',
    });
    assert.equal(preflight.checks.some((check) => check.detail === 'WRONG_NETWORK'), true);
  });

  it('rejects an expired package', () => {
    const pkg = feePackage({
      approvalValidFromUtc: '2026-01-01T00:00:00.000Z',
      approvalValidUntilUtc: '2026-01-02T00:00:00.000Z',
    });
    const preflight = runPreflight({ pkg, nowUtc: '2026-08-17T12:00:00.000Z' });
    assert.equal(preflight.checks.some((check) => check.detail === 'EXPIRED_PACKAGE'), true);
  });

  it('refuses AI approval and activation', () => {
    const pkg = feePackage();
    const ai = signApproval({ actorId: 'ai_analyst', actorKind: 'AI', role: 'AI_ANALYST', pkg });
    assert.equal(ai.rejectionReason, 'AI_CANNOT_AUTHORIZE');
    const approvals = evaluateApprovals(pkg, [ai]);
    const activation = activatePackage({
      pkg,
      approvals,
      preflight: runPreflight({ pkg }),
      height: 20,
      actorKind: 'AI',
      actorId: 'ai_analyst',
    });
    assert.equal(activation.rejectionReason, 'AI_CANNOT_AUTHORIZE');
  });

  it('refuses activation before the coordinate and with insufficient approval', () => {
    const pkg = feePackage();
    const one = [fixtureHumanApprovals(pkg)[0]!];
    const insufficient = evaluateApprovals(pkg, one);
    const early = activatePackage({
      pkg,
      approvals: evaluateApprovals(pkg, fixtureHumanApprovals(pkg)),
      preflight: runPreflight({ pkg }),
      height: 19,
      actorKind: 'HUMAN',
      actorId: 'operator',
    });
    assert.equal(early.rejectionReason, 'ACTIVATION_NOT_BEFORE_COORDINATE');
    const refused = activatePackage({
      pkg,
      approvals: insufficient,
      preflight: runPreflight({ pkg }),
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'operator',
    });
    assert.equal(refused.rejectionReason, 'INSUFFICIENT_APPROVAL');
  });

  it('activates only after human multi-person approval at the scheduled height', () => {
    const pkg = feePackage();
    const approvals = evaluateApprovals(pkg, fixtureHumanApprovals(pkg));
    assert.equal(approvals.satisfied, true);
    const activation = activatePackage({
      pkg,
      approvals,
      preflight: runPreflight({ pkg }),
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'operator',
      binaryInstalled: true,
    });
    assert.equal(activation.accepted, true);
    assert.equal(activation.policyActivated, true);
    const post = verifyPostActivation({ pkg, activation, observedPolicyVersion: 3 });
    assert.equal(post.passed, true);
    assert.equal(post.historyRewritten, false);
  });

  it('refuses emergency overreach, minting, and supply rewrite', () => {
    const pkg = feePackage();
    const policy = developmentEmergencyPolicy();
    const approvals = fixtureHumanApprovals(pkg);
    const overreach = applyEmergencyAction({
      policy,
      actionId: 'bad_1',
      incidentReference: 'INC-1',
      actionClass: 'MINT_NATIVE_ASSETS',
      scope: 'all',
      packageHash: pkg.packageHash,
      approvals,
      activation: pkg.activation,
      evidenceHash: pkg.evidence.formalReportHash,
      requestedPower: 'MINT_NATIVE_ASSETS',
    });
    assert.equal(overreach.accepted, false);
    const mint = applyEmergencyAction({
      policy,
      actionId: 'bad_2',
      incidentReference: 'INC-1',
      actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
      scope: 'moonrey',
      packageHash: pkg.packageHash,
      approvals,
      activation: pkg.activation,
      evidenceHash: pkg.evidence.formalReportHash,
      requestedPower: 'MINT_NATIVE_ASSETS',
    });
    assert.equal(mint.rejectionReason, 'EMERGENCY_CANNOT_MINT');
    const rewrite = applyEmergencyAction({
      policy,
      actionId: 'bad_3',
      incidentReference: 'INC-1',
      actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
      scope: 'supply',
      packageHash: pkg.packageHash,
      approvals,
      activation: pkg.activation,
      evidenceHash: pkg.evidence.formalReportHash,
      requestedPower: 'REWRITE_SUPPLY',
    });
    assert.equal(rewrite.rejectionReason, 'EMERGENCY_SUPPLY_REWRITE');
  });

  it('requires authority to restore a temporary restriction', () => {
    const pkg = feePackage();
    const action = applyEmergencyAction({
      policy: developmentEmergencyPolicy(),
      actionId: 'emg_1',
      incidentReference: 'INC-ORACLE',
      actionClass: 'SUSPEND_ORACLE_PROVIDER',
      scope: 'provider:oracle_dev_1',
      packageHash: pkg.packageHash,
      approvals: fixtureHumanApprovals(pkg),
      activation: pkg.activation,
      expiresAtHeight: 80,
      evidenceHash: pkg.evidence.qualificationReportHash,
    });
    assert.equal(action.accepted, true);
    const denied = reviewEmergencyRestriction({
      action,
      height: 80,
      resumeApprovals: [],
      actorKind: 'AI',
    });
    assert.equal(denied.rejectionReason, 'RESTORATION_REQUIRES_AUTHORITY');
  });

  it('rehearses fee, MoonRey, treasury, and emergency paths', () => {
    const fee = rehearseFeePolicyChange();
    assert.equal(fee.activated, true);
    assert.equal(fee.postVerified, true);
    assert.equal(fee.validatorsReady.length, 7);
    const moonrey = rehearseMoonReyPolicyChange();
    assert.equal(moonrey.oldPolicyVersion, 1);
    assert.equal(moonrey.newPolicyVersion, 2);
    assert.equal(moonrey.historyReproducible, true);
    const treasury = rehearseTreasuryBudgetChange();
    assert.equal(treasury.activated, true);
    assert.equal(treasury.newBudgetVersion, 2);
    const emergency = rehearseOracleCompromiseEmergency();
    assert.equal(emergency.authorized, true);
    assert.equal(emergency.supplyRewritten, false);
    assert.equal(emergency.resumeWithoutAuthorityRejected, true);
    assert.equal(emergency.resumeWithAuthority, true);
  });

  it('keeps offline packages free of private keys', () => {
    const offline = buildOfflinePackage(feePackage(), ['sig_public']);
    assert.equal(offline.containsPrivateKeys, false);
  });

  it('exposes governance CLI commands', () => {
    for (const command of ['package', 'diff', 'preflight', 'approvals', 'activation', 'verify', 'emergency', 'audit']) {
      const result = runGovernanceOpsCommand([command]);
      assert.equal(result.ok, true, command);
    }
  });

  it('verifies GOVERNANCE_OPERATION_SAFETY within model bounds', () => {
    const report = exploreModel(createGovernanceOpsModel({ maxHeight: 3 }), 'FORMAL_SMOKE', 'sunrey-formal-explicit-state/1');
    assert.equal(report.result, 'VERIFIED_WITHIN_MODEL_BOUNDS');
  });

  it('binds economic RC hashes so a changed proposal invalidates them', () => {
    const first = bindEconomicReleaseCandidate(developmentEvidence('a'));
    const second = bindEconomicReleaseCandidate(developmentEvidence('b'));
    assert.notEqual(first.economicReleaseCandidateHash, second.economicReleaseCandidateHash);
    const snapshots = developmentFeeSnapshots(1);
    const left = diffPolicySnapshots(snapshots.current, snapshots.proposed);
    const right = diffPolicySnapshots(snapshots.current, { ...snapshots.proposed, parameters: { ...snapshots.proposed.parameters, extra: '1' } });
    assert.notEqual(left.diffHash, right.diffHash);
  });
});
