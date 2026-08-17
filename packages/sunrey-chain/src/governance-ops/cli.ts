import { assertNoPrivateKeyMaterial } from '../ops/logging.ts';
import {
  activatePackage,
  auditOperation,
  buildEconomicChange,
  buildOfflinePackage,
  buildOperationPackage,
  developmentEvidence,
  developmentFeeSnapshots,
  evaluateApprovals,
  fixtureHumanApprovals,
  publicView,
  runPreflight,
  verifyPostActivation,
} from './engine.ts';
import {
  rehearseFeePolicyChange,
  rehearseMoonReyPolicyChange,
  rehearseOracleCompromiseEmergency,
  rehearseTreasuryBudgetChange,
} from './rehearsals.ts';

export function governanceOpsUsage(): string {
  return [
    'sunrey-ops governance package',
    'sunrey-ops governance diff',
    'sunrey-ops governance preflight',
    'sunrey-ops governance approvals',
    'sunrey-ops governance activation',
    'sunrey-ops governance verify',
    'sunrey-ops governance emergency',
    'sunrey-ops governance audit',
  ].join('\n');
}

export function runGovernanceOpsCommand(args: readonly string[]): {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
} {
  const action = args[0] ?? 'package';
  const snapshots = developmentFeeSnapshots(20);
  const evidence = developmentEvidence('cli');
  const economic = buildEconomicChange({
    current: snapshots.current,
    proposed: snapshots.proposed,
    activation: { kind: 'HEIGHT', height: 20, epoch: null },
    evidence,
  });
  const pkg = buildOperationPackage({
    packageId: 'govops-cli-fee-1',
    operationType: 'FEE_POLICY',
    activation: economic.activation,
    economic,
    evidence: economic.evidence,
  });
  const approvals = evaluateApprovals(pkg, fixtureHumanApprovals(pkg));
  const preflight = runPreflight({ pkg, approvals });
  if (action === 'package') {
    return { ok: true, command: 'governance package', payload: { package: pkg, offline: buildOfflinePackage(pkg, []) } };
  }
  if (action === 'diff') {
    return { ok: true, command: 'governance diff', payload: pkg.economic?.canonicalDiff ?? null };
  }
  if (action === 'preflight') {
    return { ok: preflight.passed, command: 'governance preflight', payload: preflight };
  }
  if (action === 'approvals') {
    return { ok: approvals.satisfied, command: 'governance approvals', payload: approvals };
  }
  if (action === 'activation') {
    const activation = activatePackage({
      pkg,
      approvals,
      preflight,
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'cli_operator',
    });
    return { ok: activation.accepted, command: 'governance activation', payload: activation };
  }
  if (action === 'verify') {
    const activation = activatePackage({
      pkg,
      approvals,
      preflight,
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'cli_operator',
    });
    const post = verifyPostActivation({ pkg, activation, observedPolicyVersion: 3 });
    return { ok: post.passed, command: 'governance verify', payload: { activation, post, public: publicView({ pkg, approvals, activation }) } };
  }
  if (action === 'emergency') {
    const emergency = rehearseOracleCompromiseEmergency();
    return {
      ok: emergency.authorized && emergency.resumeWithoutAuthorityRejected,
      command: 'governance emergency',
      payload: emergency,
    };
  }
  if (action === 'audit') {
    const activation = activatePackage({
      pkg,
      approvals,
      preflight,
      height: 20,
      actorKind: 'HUMAN',
      actorId: 'cli_operator',
    });
    const post = verifyPostActivation({ pkg, activation, observedPolicyVersion: 3 });
    return {
      ok: true,
      command: 'governance audit',
      payload: {
        audit: auditOperation({ pkg, approvals, activation, postActivation: post }),
        fee: rehearseFeePolicyChange(),
        moonrey: rehearseMoonReyPolicyChange(),
        treasury: rehearseTreasuryBudgetChange(),
      },
    };
  }
  return { ok: false, command: `governance ${action}`, payload: { error: 'unknown governance command', usage: governanceOpsUsage() } };
}

export function runGovernanceOpsCli(args: readonly string[]): string {
  const result = runGovernanceOpsCommand(args);
  assertNoPrivateKeyMaterial(result);
  return JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}
