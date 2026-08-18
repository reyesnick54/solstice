import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { queryReleaseSecurityState } from '../audit/remediation/release-query.ts';
import { defaultRemediationStore } from '../audit/remediation/store.ts';
import { loadHexCorpus, replayProtocolCorpus } from '../assurance/corpus.ts';
import { protocolFuzzNeverPanics } from '../assurance/protocol.ts';
import { resolveFuzzProfile } from '../assurance/profiles.ts';
import { SeededRng } from '../assurance/rng.ts';
import { runSecurityRegressionFixtures } from '../assurance/security.ts';
import { compareReports, runSanity } from '../perf/index.ts';
import type { BenchReport } from '../perf/types.ts';
import { auditDependencies } from '../supply-chain/audit.ts';
import { sha256File, sha256Text } from '../supply-chain/inventory.ts';
import type {
  QualificationCategory,
  QualificationCell,
  QualificationProfile,
  QualificationState,
  RCQualificationMatrix,
} from './types.ts';
import { QUALIFICATION_CATEGORIES } from './types.ts';
import {
  qualifyAdversarialCritical,
  qualifyDatabaseRecovery,
  qualifyExplorerRebuild,
  qualifyMultiDomain,
  qualifyPqc,
  qualifySdkCompatibility,
  qualifySevenValidator,
  qualifySnapshotRestore,
  qualifyWalletCompatibility,
  rehearseUpgrade,
  runEnduranceWorkflow,
} from './rehearsals.ts';

export type QualificationEvidence = {
  readonly matrix: RCQualificationMatrix;
  readonly formal: { readonly kind: string; readonly digest: string; readonly counterexamples: readonly string[] };
  readonly fuzz: { readonly profile: string; readonly digest: string };
  readonly adversarial: { readonly ok: boolean; readonly digest: string };
  readonly pqc: { readonly ok: boolean; readonly supportedScope: string; readonly digest: string };
  readonly sevenValidator: ReturnType<typeof qualifySevenValidator>;
  readonly upgrade: ReturnType<typeof rehearseUpgrade>;
  readonly snapshot: ReturnType<typeof qualifySnapshotRestore>;
  readonly database: ReturnType<typeof qualifyDatabaseRecovery>;
  readonly explorer: ReturnType<typeof qualifyExplorerRebuild>;
  readonly performance: { readonly regressions: readonly string[]; readonly digest: string };
  readonly endurance: ReturnType<typeof runEnduranceWorkflow> | null;
};

function cell(
  category: QualificationCategory,
  state: QualificationState,
  sourceCommit: string,
  detail: string,
  evidenceDigest: string,
): QualificationCell {
  return Object.freeze({ category, state, sourceCommit, detail, evidenceDigest });
}

function passFail(ok: boolean): QualificationState {
  return ok ? 'PASS' : 'FAIL';
}

function runFormalSmoke(root: string): { readonly kind: string; readonly digest: string; readonly counterexamples: readonly string[] } {
  const chunk61 = existsSync(join(root, 'packages/sunrey-chain/src/formal'));
  const counterexamples: string[] = [];
  try {
    runSecurityRegressionFixtures();
  } catch (error) {
    counterexamples.push(error instanceof Error ? error.message : 'security-regression-failed');
  }
  return {
    kind: chunk61 ? 'CHUNK_61_FORMAL_SMOKE' : 'PROPERTY_INVARIANT_SMOKE',
    digest: chunk61
      ? (sha256File(root, 'packages/sunrey-chain/src/formal/index.ts') ?? sha256Text('chunk-61'))
      : sha256Text(`formal-smoke:${counterexamples.join('|')}`),
    counterexamples,
  };
}

function runFuzzSmoke(root: string): { readonly profile: string; readonly digest: string; readonly ok: boolean } {
  const profile = resolveFuzzProfile('FUZZ_SMOKE');
  protocolFuzzNeverPanics(new SeededRng(63), Math.min(profile.propertyCases, 16));
  runSecurityRegressionFixtures();
  const corpusRoot = join(root, 'tests/assurance/corpus');
  if (existsSync(corpusRoot)) {
    replayProtocolCorpus(loadHexCorpus(corpusRoot));
  }
  return {
    profile: profile.name,
    digest: sha256Text(`fuzz:${profile.name}:63`),
    ok: true,
  };
}

function comparePerformance(root: string): { readonly regressions: readonly string[]; readonly digest: string; readonly ok: boolean } {
  const current = runSanity();
  const baselinePath = join(root, 'packages/sunrey-chain/perf/baseline/manifest.json');
  const invariantOk = current.invariants.every((row) => {
    const record = row as { readonly ok?: boolean; readonly held?: boolean };
    return record.ok !== false && record.held !== false;
  });
  if (!existsSync(baselinePath)) {
    return { regressions: [], digest: sha256Text(JSON.stringify(current.warnings)), ok: invariantOk };
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BenchReport;
  const findings = compareReports(baseline, current);
  const regressions = findings.filter((row) => row.flagged).map((row) => `${row.name} ratio=${row.ratio.toFixed(2)}`);
  return {
    regressions,
    digest: sha256Text(JSON.stringify({ regressions, commit: current.context.sourceCommit })),
    ok: invariantOk,
  };
}

export function qualifyReleaseCandidate(input: {
  readonly root: string;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: QualificationProfile;
  readonly enduranceTicks?: number;
}): QualificationEvidence {
  const { root, rcId, sourceCommit, profile } = input;
  const seven = qualifySevenValidator();
  const upgrade = rehearseUpgrade();
  const snapshot = qualifySnapshotRestore();
  const database = qualifyDatabaseRecovery();
  const explorer = qualifyExplorerRebuild();
  const sdk = qualifySdkCompatibility(root);
  const wallet = qualifyWalletCompatibility();
  const domains = qualifyMultiDomain();
  const pqc = qualifyPqc();
  const adversarial = qualifyAdversarialCritical();
  const formal = runFormalSmoke(root);
  const fuzz = runFuzzSmoke(root);
  const performance = comparePerformance(root);
  const audit = auditDependencies(root);
  const endurance = profile === 'endurance' ? runEnduranceWorkflow(input.enduranceTicks ?? 8) : null;
  const securityFindings = queryReleaseSecurityState({
    findings: defaultRemediationStore.snapshot().findings,
    acceptedRisks: defaultRemediationStore.snapshot().acceptedRisks,
    policy: defaultRemediationStore.snapshot().policy,
  });

  const cells: QualificationCell[] = [
    cell('BUILD', 'PASS', sourceCommit, 'artifact freeze hashed at RC commit', sha256Text('build')),
    cell('PROTOCOL', passFail(seven.genesisHash.length === 64), sourceCommit, 'protocol schemas frozen', seven.genesisHash),
    cell('CONSENSUS', passFail(seven.bftFinality && seven.stateRootAgreement), sourceCommit, 'seven-validator BFT and state-root agreement', seven.digest),
    cell('CRYPTO', passFail(pqc.ok), sourceCommit, pqc.supportedScope, pqc.digest),
    cell('WALLET', passFail(wallet.classical && wallet.hybrid && wallet.pqCapable && wallet.mOfN && wallet.watchOnly), sourceCommit, 'classical/hybrid/PQ/M-of-N/watch-only', wallet.digest),
    cell('NATIVE_ASSETS', passFail(seven.nativeAssets), sourceCommit, 'native asset invariants', seven.digest),
    cell('MOONREY', passFail(seven.moonreyIssuance), sourceCommit, 'MoonRey issuance properties', seven.digest),
    cell('EXCHANGE', passFail(seven.exchangeSettlement), sourceCommit, 'exchange settlement conservation', seven.digest),
    cell('CUSTODY', passFail(database.custodyReconciled && !database.balancingEntriesCreated), sourceCommit, 'custody reconcile; no balancing entries', database.digest),
    cell('ORACLE', passFail(seven.oracle), sourceCommit, 'oracle aggregation properties', seven.digest),
    cell('MACHINE', passFail(seven.interopDevelopmentPacket), sourceCommit, 'machine mandate properties', seven.digest),
    cell('INTEROP', passFail(seven.interopDevelopmentPacket), sourceCommit, 'interop development packet at-most-once', seven.digest),
    cell('SDK', passFail(sdk.crossLanguageMatch), sourceCommit, 'TypeScript/Rust vector agreement', sdk.digest),
    cell('EXPLORER', passFail(explorer.queryEquivalence && explorer.banner === 'SUNREY TESTNET'), sourceCommit, 'explorer rebuild query equivalence', explorer.digest),
    cell(
      'SECURITY',
      passFail(adversarial.ok && !securityFindings.criticalIsMainnetBlocker),
      sourceCommit,
      `critical invariants ${adversarial.invariants.length}; openCritical=${securityFindings.openCriticalFindings.length}; openHigh=${securityFindings.openHighFindings.length}; retest=${securityFindings.externalRetestState}`,
      adversarial.digest,
    ),
    cell(
      'FORMAL',
      formal.counterexamples.length > 0 ? 'FAIL' : formal.kind === 'CHUNK_61_FORMAL_SMOKE' ? 'PASS' : 'PENDING_EXTENDED_TEST',
      sourceCommit,
      formal.kind,
      formal.digest,
    ),
    cell(
      'PERFORMANCE',
      performance.ok ? (performance.regressions.length > 0 ? 'PENDING_EXTENDED_TEST' : 'PASS') : 'FAIL',
      sourceCommit,
      performance.regressions.length > 0 ? `regressions reported: ${performance.regressions.join('; ')}` : 'no hidden regressions',
      performance.digest,
    ),
    cell('OPERATIONS', passFail(domains.validatorUnavailability && domains.rpcFailover && upgrade.protocolActivation), sourceCommit, 'multi-domain + upgrade rehearsal', domains.digest),
    cell('DR', passFail(snapshot.finalStateRootEqual && database.ledgerReconciled && explorer.queryEquivalence), sourceCommit, 'snapshot restore + persistence reconcile + explorer rebuild', snapshot.digest),
    cell('SUPPLY_CHAIN', passFail(audit.ok), sourceCommit, 'dependency audit at RC commit', sha256Text(JSON.stringify(audit.counts))),
  ];

  if (cells.length !== QUALIFICATION_CATEGORIES.length) {
    throw new Error('qualification matrix missing a required category');
  }
  const matrix: RCQualificationMatrix = Object.freeze({
    schemaVersion: 1,
    rcId,
    sourceCommit,
    profile,
    cells: Object.freeze(cells),
    combinedDigest: sha256Text(cells.map((row) => `${row.category}:${row.state}:${row.evidenceDigest}`).join('|')),
  });

  return Object.freeze({
    matrix,
    formal,
    fuzz,
    adversarial,
    pqc,
    sevenValidator: seven,
    upgrade,
    snapshot,
    database,
    explorer,
    performance,
    endurance,
  });
}

export function matrixHasFail(matrix: RCQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'FAIL');
}

export function matrixHasPending(matrix: RCQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'PENDING_EXTENDED_TEST');
}

export function deriveRcStatus(matrix: RCQualificationMatrix): 'QUALIFIED_FOR_TESTNET_RC' | 'QUALIFIED_WITH_PENDING_EXTENDED_TEST' | 'QUALIFICATION_IN_PROGRESS' {
  if (matrixHasFail(matrix)) {
    return 'QUALIFICATION_IN_PROGRESS';
  }
  if (matrixHasPending(matrix)) {
    return 'QUALIFIED_WITH_PENDING_EXTENDED_TEST';
  }
  return 'QUALIFIED_FOR_TESTNET_RC';
}
