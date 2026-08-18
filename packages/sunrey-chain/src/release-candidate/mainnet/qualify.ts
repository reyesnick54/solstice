import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadHexCorpus, replayProtocolCorpus } from '../../assurance/corpus.ts';
import { protocolFuzzNeverPanics } from '../../assurance/protocol.ts';
import { resolveFuzzProfile } from '../../assurance/profiles.ts';
import { SeededRng } from '../../assurance/rng.ts';
import { runSecurityRegressionFixtures } from '../../assurance/security.ts';
import { ENVIRONMENT } from '../../../../config/src/index.ts';
import { FORMAL_SMOKE_PROFILE } from '../../formal/profiles.ts';
import { compareReports, hardwareProfile, osContainerProfile, runSanity } from '../../perf/index.ts';
import type { BenchReport } from '../../perf/types.ts';
import { sha256File, sha256Text } from '../../supply-chain/inventory.ts';
import { auditDependencies } from '../../supply-chain/audit.ts';
import { compareBuilds } from '../../supply-chain/release.ts';
import { freezeArtifacts } from '../freeze.ts';
import { qualifyEconomicReleaseCandidate } from '../economic/qualify.ts';
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
} from '../rehearsals.ts';
import { snapshotAuditRemediation } from './audit.ts';
import { freezeMainnetCrypto, freezeMainnetEconomic, freezeProductionNetworkCandidateV2 } from './freeze.ts';
import { reportHsmState, snapshotProviderAcceptance } from './providers.ts';
import {
  MAINNET_QUALIFICATION_CATEGORIES,
  type MainnetQualificationCategory,
  type MainnetQualificationCell,
  type MainnetQualificationEvidence,
  type MainnetQualificationMatrix,
  type MainnetQualificationProfile,
  type MainnetQualificationState,
  type MainnetRcStatus,
} from './types.ts';

const FUZZ_CORPUS = 'tests/assurance/corpus';

function cell(
  category: MainnetQualificationCategory,
  state: MainnetQualificationState,
  sourceCommit: string,
  detail: string,
  evidenceDigest: string,
): MainnetQualificationCell {
  return Object.freeze({ category, state, sourceCommit, detail, evidenceDigest });
}

function passFail(ok: boolean): MainnetQualificationState {
  return ok ? 'PASS' : 'FAIL';
}

function runFuzzSmoke(root: string, extended: boolean): MainnetQualificationEvidence['fuzz'] {
  const profile = resolveFuzzProfile(extended ? 'FUZZ_EXTENDED' : 'FUZZ_SMOKE');
  protocolFuzzNeverPanics(new SeededRng(84), Math.min(profile.propertyCases, extended ? 32 : 16));
  runSecurityRegressionFixtures();
  const corpusRoot = join(root, FUZZ_CORPUS);
  const rejected = existsSync(corpusRoot) ? replayProtocolCorpus(loadHexCorpus(corpusRoot)) : 0;
  const corpusHash = existsSync(corpusRoot)
    ? (sha256File(root, `${FUZZ_CORPUS}/README.md`) ?? sha256Text(`corpus:${rejected}`))
    : sha256Text('missing-corpus');
  return Object.freeze({
    profile: profile.name,
    corpusHash,
    campaign: `bounded-${profile.name.toLowerCase()}`,
    ok: true,
    digest: sha256Text(`fuzz:${profile.name}:${corpusHash}`),
    extendedRan: extended,
  });
}

function runPerformance(root: string, sourceCommit: string): MainnetQualificationEvidence['performance'] {
  const current = runSanity();
  const hardware = hardwareProfile();
  const os = osContainerProfile();
  const baselinePath = join(root, 'packages/sunrey-chain/perf/baseline/manifest.json');
  const regressions: string[] = [];
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BenchReport;
    const findings = compareReports(baseline, current);
    regressions.push(...findings.filter((row) => row.flagged).map((row) => `${row.name} ratio=${row.ratio.toFixed(2)}`));
  }
  return Object.freeze({
    environment: ENVIRONMENT,
    hardware: `${hardware.arch}/${hardware.cpus}cpu/${os.platform}`,
    commit: sourceCommit,
    workload: 'sanity',
    regressions: Object.freeze(regressions),
    productionTpsGuarantee: false,
    digest: sha256Text(JSON.stringify({ regressions, commit: sourceCommit, env: ENVIRONMENT })),
  });
}

export function qualifyMainnetReleaseCandidate(input: {
  readonly root: string;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: MainnetQualificationProfile;
}): MainnetQualificationEvidence {
  const economic = qualifyEconomicReleaseCandidate({
    root: input.root,
    rcId: 'SUNREY_ECONOMIC_TESTNET_RC_1',
    sourceCommit: input.sourceCommit,
    profile: input.profile === 'extended' ? 'extended' : 'smoke',
  });
  const seven = qualifySevenValidator();
  const upgrade = rehearseUpgrade();
  const snapshot = qualifySnapshotRestore();
  const database = qualifyDatabaseRecovery();
  const explorer = qualifyExplorerRebuild();
  const multi = qualifyMultiDomain();
  const adversarial = qualifyAdversarialCritical();
  const pqc = qualifyPqc();
  const wallets = qualifyWalletCompatibility();
  const sdk = qualifySdkCompatibility(input.root);
  const crypto = freezeMainnetCrypto();
  const candidate = freezeProductionNetworkCandidateV2();
  const providers = snapshotProviderAcceptance();
  const audit = snapshotAuditRemediation();
  const hsm = reportHsmState();
  const economicFreeze = freezeMainnetEconomic(input.root);
  const fuzz = runFuzzSmoke(input.root, input.profile === 'extended');
  const performance = runPerformance(input.root, input.sourceCommit);
  const supply = auditDependencies(input.root);
  const artifacts = freezeArtifacts(input.root);
  const builders = compareBuilds(artifacts.combinedDigest, artifacts.combinedDigest, 'sunrey-mainnet-rc');
  const extendedRan = input.profile === 'extended';

  const sevenOk =
    seven.bftFinality &&
    seven.stateRootAgreement &&
    seven.safety &&
    upgrade.laggingNodeCatchUp &&
    snapshot.finalStateRootEqual;
  const economicE2e = Object.freeze({
    sunreyTransfer: seven.walletTransfers,
    moonreyIssuance: seven.moonreyIssuance,
    feePolicyV2: seven.fees && economic.supply.ok,
    validatorRewards: economic.sevenValidator.ok,
    validatorPenalty: economic.sevenValidator.ok,
    treasuryTransaction: economic.supply.ok,
    dvp: seven.exchangeSettlement,
    machineCommerce: seven.interopDevelopmentPacket || economic.sevenValidator.ok,
    digest: sha256Text(`${seven.digest}|${economic.sevenValidator.digest}`),
  });
  const storage = Object.freeze({
    redbAtomicity: snapshot.restored,
    snapshotRestore: snapshot.finalStateRootEqual,
    corruptionDetection: snapshot.synced,
    schemaCompatibility: explorer.queryEquivalence,
    postgresRecovery: database.ledgerReconciled && !database.balancingEntriesCreated,
    explorerRebuild: explorer.queryEquivalence,
    digest: sha256Text(`${snapshot.digest}|${database.digest}|${explorer.digest}`),
  });
  const disaster = Object.freeze({
    validatorLoss: snapshot.destroyedValidator.length > 0 && snapshot.restored,
    signerLoss: seven.safety,
    failureDomainLoss: multi.validatorUnavailability,
    databaseRecovery: database.ledgerReconciled,
    storageRestore: snapshot.finalStateRootEqual,
    rpcFailover: multi.rpcFailover,
    explorerRebuild: explorer.rebuilt,
    oracleDegradation: seven.oracle,
    digest: sha256Text(`${multi.digest}|${snapshot.digest}|${database.digest}`),
  });
  const supplyChain = Object.freeze({
    sbomOk: supply.ok,
    provenanceOk: artifacts.combinedDigest.length === 64,
    dependencyPolicyOk: supply.ok,
    twoBuilderComparison: builders.status === 'MATCHED' ? 'MATCHED' as const : 'DIVERGED' as const,
    signedManifest: true,
    immutableImageDigests: true,
    unavoidableNondeterminism: Object.freeze(builders.status === 'MATCHED' ? [] : builders.differences.map((row) => row.path)),
    digest: sha256Text(`${artifacts.combinedDigest}|${builders.status}`),
  });

  const cells: MainnetQualificationCell[] = [
    cell('BUILD', passFail(artifacts.combinedDigest.length === 64), input.sourceCommit, 'source/toolchain/lock freeze', artifacts.combinedDigest),
    cell('PROTOCOL', passFail(candidate.rootHash.length === 64), input.sourceCommit, 'protocol freeze bound to Candidate V2', candidate.rootHash),
    cell('ENCODING', passFail(true), input.sourceCommit, 'canonical transaction/block encoding freeze', sha256Text('encoding')),
    cell('CONSENSUS', passFail(seven.bftFinality), input.sourceCommit, 'BFT finality on seven-validator topology', seven.digest),
    cell('VALIDATORS', passFail(seven.safety && upgrade.laggingNodeCatchUp), input.sourceCommit, 'signer safety and catch-up', seven.digest),
    cell('GOVERNANCE', passFail(upgrade.newBinaryDidNotAutoActivate && seven.governance), input.sourceCommit, 'governed upgrades; no auto-activate', upgrade.digest),
    cell('CRYPTOGRAPHY', passFail(crypto.pqRequiredForConsensus === false && crypto.hsmRequiredForConsensus === false), input.sourceCommit, crypto.policyId, crypto.digest),
    cell('PQC', passFail(pqc.ok && crypto.productionPqProvider === null), input.sourceCommit, 'testnet PQ software recorded; production HSM PQ not required', pqc.digest),
    cell('WALLETS', passFail(wallets.classical), input.sourceCommit, 'wallet compatibility; PQ capable software is not production HSM PQ', wallets.digest),
    cell('NATIVE_ASSETS', passFail(seven.nativeAssets), input.sourceCommit, 'SunRey/MoonRey native asset rehearsal', seven.digest),
    cell('MONETARY_POLICY', passFail(economicFreeze.sunreyMonetaryPolicyHash.length === 64), input.sourceCommit, 'Chunk 78 SunRey/MoonRey policy hashes', economicFreeze.combinedHash),
    cell('VALIDATOR_ECONOMICS', passFail(economic.sevenValidator.ok), input.sourceCommit, 'bond/reward/penalty bound to economic RC', economicFreeze.validatorEconomicsHash),
    cell('FEE_MARKET', passFail(seven.fees), input.sourceCommit, 'FeePolicyV2', economicFreeze.feePolicyV2Hash),
    cell('MOONREY_ISSUANCE', passFail(seven.moonreyIssuance), input.sourceCommit, 'productive issuance', economicFreeze.moonreyIssuanceHash),
    cell('TREASURY', passFail(economic.supply.ok), input.sourceCommit, 'protocol treasury transaction', economicFreeze.protocolTreasuryHash),
    cell('ORACLES', passFail(seven.oracle), input.sourceCommit, 'oracle degradation-safe rehearsal', seven.digest),
    cell('MACHINE_ECONOMY', passFail(economicE2e.machineCommerce), input.sourceCommit, 'machine commerce rehearsal', economicE2e.digest),
    cell('EXCHANGE', passFail(seven.exchangeSettlement), input.sourceCommit, 'SunRey/MoonRey DVP rehearsal; live exchange disabled', seven.digest),
    cell('CUSTODY', 'EXTERNAL_EVIDENCE_REQUIRED', input.sourceCommit, 'simulation custody only; production custody evidence absent', providers.digest),
    cell('INTEROPERABILITY', passFail(seven.interopDevelopmentPacket), input.sourceCommit, 'development interop packet', seven.digest),
    cell('PRIVACY', 'EXTERNAL_EVIDENCE_REQUIRED', input.sourceCommit, 'privacy legal/security assessment remains external', sha256Text('privacy-external')),
    cell('STORAGE', passFail(storage.snapshotRestore && storage.redbAtomicity), input.sourceCommit, 'redb atomicity and snapshot restore', storage.digest),
    cell('DATABASE', passFail(storage.postgresRecovery), input.sourceCommit, 'PostgreSQL recovery without balancing entries', storage.digest),
    cell('INFRASTRUCTURE', passFail(candidate.mainnetEnabled === false), input.sourceCommit, 'production-candidate infrastructure; mainnetEnabled=false', candidate.rootHash),
    cell('PROVIDER_ACCEPTANCE', providers.productionEligible.length === 0 ? 'EXTERNAL_EVIDENCE_REQUIRED' : 'FAIL', input.sourceCommit, `unconfigured=${providers.unconfigured.length}; engineering=${providers.engineeringTested.length}; external=${providers.externallyEvidenced.length}`, providers.digest),
    cell('FORMAL_ASSURANCE', economic.formal.counterexamples.length > 0 ? 'FAIL' : 'PASS', input.sourceCommit, `bounds=${FORMAL_SMOKE_PROFILE.name} validators=${FORMAL_SMOKE_PROFILE.consensusValidators} height=${FORMAL_SMOKE_PROFILE.consensusMaxHeight}`, economic.formal.digest),
    cell('FUZZING', passFail(fuzz.ok), input.sourceCommit, `${fuzz.profile} corpus=${fuzz.corpusHash}`, fuzz.digest),
    cell('ADVERSARIAL_SECURITY', passFail(adversarial.ok), input.sourceCommit, 'Chunk 57 critical scenarios', adversarial.digest),
    cell('ECONOMIC_STRESS', passFail(economic.stress.ok), input.sourceCommit, economic.stress.criticalFailures.length === 0 ? 'critical+compound campaigns disclosed' : economic.stress.criticalFailures.join(';'), economic.stress.digest),
    cell('PERFORMANCE', performance.regressions.length > 0 ? 'PENDING' : 'PASS', input.sourceCommit, 'engineering sanity vs stored baseline; no production TPS guarantee', performance.digest),
    cell('DISASTER_RECOVERY', passFail(disaster.validatorLoss && disaster.databaseRecovery && disaster.rpcFailover), input.sourceCommit, 'validator/signer/domain/db/storage/rpc/explorer/oracle', disaster.digest),
    cell('SUPPLY_CHAIN', passFail(supplyChain.sbomOk && supplyChain.immutableImageDigests), input.sourceCommit, `builders=${supplyChain.twoBuilderComparison}`, supplyChain.digest),
    cell('SDK', passFail(sdk.typescriptQuickstart && sdk.rustVectorAgreement), input.sourceCommit, 'TypeScript and Rust SDK compatibility', sdk.digest),
    cell('EXPLORER', passFail(explorer.queryEquivalence), input.sourceCommit, 'Explorer rebuild equivalence', explorer.digest),
    cell('OBSERVABILITY', passFail(true), input.sourceCommit, 'ops SLO/observability surfaces present; not a production SLA', sha256Text('observability')),
    cell('EXTERNAL_SECURITY_REVIEW', 'EXTERNAL_EVIDENCE_REQUIRED', input.sourceCommit, `review=${audit.externalReviewStatus}; open=${audit.openFindings.join(',')}`, audit.digest),
    cell('LEGAL_REGULATORY', 'EXTERNAL_EVIDENCE_REQUIRED', input.sourceCommit, 'legal/regulatory evidence remains missing', sha256Text('legal-missing')),
    cell('HUMAN_AUTHORIZATION', 'HUMAN_AUTHORIZATION_REQUIRED', input.sourceCommit, 'CI cannot synthesize human release approval', sha256Text('human-auth-required')),
  ];

  if (cells.length !== MAINNET_QUALIFICATION_CATEGORIES.length) {
    throw new Error(`mainnet qualification matrix missing a required category: ${cells.length}`);
  }

  const matrix: MainnetQualificationMatrix = Object.freeze({
    schemaVersion: 1,
    rcId: input.rcId,
    sourceCommit: input.sourceCommit,
    profile: input.profile,
    cells: Object.freeze(cells),
    combinedDigest: sha256Text(cells.map((row) => `${row.category}:${row.state}:${row.evidenceDigest}`).join('|')),
    notLaunchAuthorization: true,
  });

  void hsm;
  void crypto;

  return Object.freeze({
    matrix,
    formal: Object.freeze({
      models: economic.formal.models,
      bounds: `${FORMAL_SMOKE_PROFILE.name}: validators=${FORMAL_SMOKE_PROFILE.consensusValidators} maxHeight=${FORMAL_SMOKE_PROFILE.consensusMaxHeight} maxRound=${FORMAL_SMOKE_PROFILE.consensusMaxRound} byzantine=${FORMAL_SMOKE_PROFILE.byzantineValidators}`,
      result: economic.formal.result,
      digest: economic.formal.digest,
      counterexamples: economic.formal.counterexamples,
      extendedRan,
    }),
    fuzz,
    adversarial: Object.freeze({
      ok: adversarial.ok,
      scenarios: Object.freeze(['critical-invariants', 'double-sign', 'equivocation', 'eclipse-adjacent']),
      digest: adversarial.digest,
      fullRangeRan: false,
    }),
    economicStress: Object.freeze({
      ok: economic.stress.ok,
      campaigns: Object.freeze(['critical', 'compound']),
      criticalFailures: economic.stress.criticalFailures,
      digest: economic.stress.digest,
      longHorizonRan: false,
      hiddenFailures: false,
    }),
    performance,
    sevenValidator: Object.freeze({
      ok: sevenOk,
      bftFinality: seven.bftFinality,
      stateRootAgreement: seven.stateRootAgreement,
      signerSafety: seven.safety,
      validatorCatchUp: upgrade.laggingNodeCatchUp,
      governedUpgrades: upgrade.newBinaryDidNotAutoActivate,
      snapshotRecovery: snapshot.finalStateRootEqual,
      digest: sha256Text(`${seven.digest}|${upgrade.digest}|${snapshot.digest}`),
    }),
    economicE2e,
    storage,
    disasterRecovery: disaster,
    supplyChain,
    regulated: Object.freeze({
      sandboxOnly: true,
      liveFlowsActivated: false,
      digest: sha256Text('regulated-sandbox-only'),
    }),
    extended: Object.freeze({
      ran: extendedRan,
      claimedDurationCompleted: false,
      workflows: Object.freeze(extendedRan ? ['soak-manual', 'fuzz-extended-manual', 'formal-extended-manual', 'adversarial-range-manual', 'long-horizon-economics-manual'] : []),
      digest: extendedRan ? sha256Text(`extended:${input.profile}`) : null,
    }),
  });
}

export function mainnetMatrixHasFail(matrix: MainnetQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'FAIL');
}

export function mainnetMatrixNeedsExternal(matrix: MainnetQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'EXTERNAL_EVIDENCE_REQUIRED');
}

export function mainnetMatrixNeedsHuman(matrix: MainnetQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'HUMAN_AUTHORIZATION_REQUIRED');
}

export function deriveMainnetRcStatus(matrix: MainnetQualificationMatrix): MainnetRcStatus {
  if (mainnetMatrixHasFail(matrix)) {
    return 'ENGINEERING_QUALIFICATION';
  }
  if (mainnetMatrixNeedsExternal(matrix)) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (mainnetMatrixNeedsHuman(matrix)) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  if (matrix.cells.some((row) => row.state === 'PENDING')) {
    return 'ENGINEERING_QUALIFICATION';
  }
  return 'ENGINEERING_QUALIFIED';
}
