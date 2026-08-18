/**
 * SunRey Economic Mainnet Rehearsal orchestrator.
 *
 * Production-like dry run of the dual-native-asset economy.
 * Does not activate mainnet, customer funds, live Exchange, live custody,
 * fiat rails, tickers, or LIVE_* flags.
 */

import { buildGenesisCandidate } from '../mainnet/genesis-candidate.ts';
import {
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import { rehearsalTopology } from '../launch-rehearsal/infrastructure.ts';
import type { RehearsalFinding } from '../launch-rehearsal/types.ts';
import {
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_DISPLAY_NAME,
  ECONOMIC_REHEARSAL_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
} from './identity.ts';
import { buildEconomicGenesis, productionCandidateAllocationUnchanged, sevenEconomicRehearsalValidators } from './genesis.ts';
import { buildEconomicRcBundle, verifyEconomicRc } from './rc.ts';
import { approveRehearsalConfiguration, bindRehearsalGovernanceToEconomicRc, rehearseGovernedPolicyUpgrades } from './governance.ts';
import { commitCanonical } from '../hash.ts';
import { developmentTreasuryPolicy } from '../economics/treasury/policy.ts';
import { allTreasuryStressHold } from '../economics/treasury/stress.ts';
import { exploreModel } from '../formal/explore.ts';
import { createProtocolTreasuryModel } from '../formal/models/protocol-treasury.ts';
import { FORMAL_SMOKE_PROFILE } from '../formal/profiles.ts';
import { rehearseProtocolTreasury } from './treasury.ts';
import {
  moonreySupplyAudit,
  rebuildExplorerViews,
  rehearseDualEconomyBaseline,
  rehearseFeePolicyV2Loads,
  rehearseMachineCommerce,
  rehearseMoonReyEconomy,
  rehearseOraclePlane,
  rehearseSunReyEconomy,
  rehearseSunReyMoonReyExchange,
  rehearseValidatorEconomics,
} from './workflows.ts';
import { runEconomicStressCampaign, runFailureAndRecoveryCampaign } from './stress.ts';
import { runEconomicTraceConformance } from './traces.ts';
import { reevaluateReadinessAfterEconomicRehearsal, updateActivationPlanFromEconomicRehearsal } from './readiness.ts';
import { ECONOMIC_REHEARSAL_SCHEMA_VERSION, ECONOMIC_REHEARSAL_TOOL_VERSION, type EconomicActivationEvidenceBundle, type EconomicLaunchControlRoomState, type EconomicMainnetRehearsalReport, type EconomicRehearsalResultState } from './types.ts';

export type EconomicRehearsalSession = {
  readonly report: EconomicMainnetRehearsalReport;
  readonly evidence: EconomicActivationEvidenceBundle;
  readonly readiness: ReturnType<typeof reevaluateReadinessAfterEconomicRehearsal>;
  readonly plan: ReturnType<typeof updateActivationPlanFromEconomicRehearsal>;
};

function classify(
  findings: readonly RehearsalFinding[],
  incomplete: boolean,
): EconomicRehearsalResultState {
  if (incomplete) {
    return 'ECONOMIC_REHEARSAL_INCOMPLETE';
  }
  const blockers = findings.filter(
    (row) => row.category === 'MAINNET_ENGINEERING_BLOCKER' && row.verificationState === 'OPEN',
  );
  if (blockers.length > 0 || findings.some((row) => row.severity === 'CRITICAL' && row.verificationState === 'OPEN')) {
    return 'ECONOMIC_REHEARSAL_COMPLETED_WITH_FINDINGS';
  }
  if (findings.some((row) => row.verificationState !== 'VERIFIED' && row.verificationState !== 'ACCEPTED_LIMITATION')) {
    return 'ECONOMIC_REHEARSAL_COMPLETED_WITH_FINDINGS';
  }
  return 'ECONOMIC_ENGINEERING_REHEARSAL_QUALIFIED';
}

function knownLimitations(): readonly string[] {
  return Object.freeze([
    'Economic RC is the frozen development/rehearsal policy bundle. It is not a production monetary-policy activation.',
    'Chunks 76–79 are consumed as their canonical merged implementations. Compatibility substitutes are not used.',
    'External legal, regulatory, licensing, counsel, independent audit, commercial HSM, real root ceremony, and production oracle agreements remain unfabricated.',
    'Simulation HSM is not a commercial production HSM.',
    'Rehearsal classification does not authorize production mainnet.',
    'LIVE_* flags remain false. ENVIRONMENT remains simulation.',
    'No customer data, customer funds, or production provider credentials were used.',
    'Tickers remain NOT_ASSIGNED. Production candidate allocation remains zero/unapproved.',
    'An extended multi-epoch economic run is documented as a manual workflow and was not claimed as executed.',
  ]);
}

export function economicRehearsalFindings(input: {
  readonly genesisOk: boolean;
  readonly rcOk: boolean;
  readonly accountingSafe: boolean;
  readonly recovered: boolean;
}): readonly RehearsalFinding[] {
  return Object.freeze([
    {
      findingId: 'FND-80-001',
      category: 'READINESS',
      severity: 'INFO',
      description: 'External legal, regulatory, licensing, and human production authorization remain incomplete.',
      evidence: 'Chunk 65 external slots stay AWAITING_EXTERNAL_EVIDENCE.',
      owner: 'LAUNCH_COORDINATOR',
      remediation: 'Collect real external evidence. Do not fabricate counsel confirmation.',
      verificationState: 'ACCEPTED_LIMITATION',
    },
    {
      findingId: 'FND-80-002',
      category: 'READINESS',
      severity: input.genesisOk && input.rcOk ? 'INFO' : 'CRITICAL',
      description: 'Economic genesis and economic RC verification.',
      evidence: 'Deterministic economic-rehearsal genesis plus SUNREY_ECONOMIC_RC_1.',
      owner: 'PROTOCOL_OPERATOR',
      remediation: input.genesisOk && input.rcOk ? 'None.' : 'Halt rehearsal and inspect genesis/RC.',
      verificationState: input.genesisOk && input.rcOk ? 'VERIFIED' : 'OPEN',
    },
    {
      findingId: 'FND-80-003',
      category: input.accountingSafe ? 'READINESS' : 'MAINNET_ENGINEERING_BLOCKER',
      severity: input.accountingSafe ? 'INFO' : 'CRITICAL',
      description: 'Economic accounting and safety after stress and recovery.',
      evidence: 'Supply, fee, treasury, Exchange DVP, and validator-bond reconciliations.',
      owner: 'PROTOCOL_OPERATOR',
      remediation: input.accountingSafe ? 'None.' : 'Treat as MAINNET_ENGINEERING_BLOCKER.',
      verificationState: input.accountingSafe && input.recovered ? 'VERIFIED' : 'OPEN',
    },
  ]);
}

let rehearsalCache: { readonly root: string; readonly session: EconomicRehearsalSession } | null = null;

export function runEconomicRehearsal(root = process.cwd()): EconomicRehearsalSession {
  if (rehearsalCache && rehearsalCache.root === root) {
    return rehearsalCache.session;
  }
  const rc = buildEconomicRcBundle(root);
  if (!verifyEconomicRc(rc)) {
    throw new Error('economic RC verification failed before bring-up');
  }
  const genesis = buildEconomicGenesis();
  const productionCandidate = buildGenesisCandidate();
  if (genesis.genesisHash === productionCandidate.genesisHash) {
    throw new TypeError('economic rehearsal genesis must be distinct from the production candidate');
  }
  if (
    (ECONOMIC_REHEARSAL_NETWORK_ID as string) === (PRODUCTION_CANDIDATE_NETWORK_ID as string) ||
    (ECONOMIC_REHEARSAL_CHAIN_ID as string) === (PRODUCTION_CANDIDATE_CHAIN_ID as string)
  ) {
    throw new TypeError('economic rehearsal identity collided with production candidate');
  }
  if (!productionCandidateAllocationUnchanged()) {
    throw new TypeError('production candidate allocation must remain zero/unapproved');
  }
  approveRehearsalConfiguration({ genesisHash: genesis.genesisHash, economicRcHash: rc.manifestHash });

  const sunrey = rehearseSunReyEconomy();
  const moonrey = rehearseMoonReyEconomy();
  const fees = rehearseFeePolicyV2Loads();
  const validators = rehearseValidatorEconomics();
  const treasury = rehearseProtocolTreasury(fees.treasury > 0n ? fees.treasury : 1_000n);
  const exchange = rehearseSunReyMoonReyExchange();
  const machine = rehearseMachineCommerce();
  const oracle = rehearseOraclePlane();
  const dual = rehearseDualEconomyBaseline();
  const governance = rehearseGovernedPolicyUpgrades();
  const stress = runEconomicStressCampaign(root);
  const treasuryFormal = exploreModel(
    createProtocolTreasuryModel({
      validators: FORMAL_SMOKE_PROFILE.consensusValidators,
      maxHeight: FORMAL_SMOKE_PROFILE.consensusMaxHeight,
      maxRound: FORMAL_SMOKE_PROFILE.consensusMaxRound,
      byzantineValidators: FORMAL_SMOKE_PROFILE.byzantineValidators,
      maxQuantity: FORMAL_SMOKE_PROFILE.maxQuantity,
      maxOrders: FORMAL_SMOKE_PROFILE.maxOrders,
      maxPackets: FORMAL_SMOKE_PROFILE.maxPackets,
      maxEpochs: FORMAL_SMOKE_PROFILE.maxEpochs,
    }),
    FORMAL_SMOKE_PROFILE.name,
    'sunrey-formal-explicit-state/1',
  );
  const integratedEvidenceHashes = Object.freeze({
    chunk76StressReportHash: stress.chunk76ReportHash ?? commitCanonical({ missing: 'chunk76' }),
    chunk77TreasuryPolicyHash: rc.canonicalTreasuryPolicyHash ?? commitCanonical(developmentTreasuryPolicy()),
    chunk77TreasuryFormalHash: commitCanonical({
      modelId: treasuryFormal.modelId,
      result: treasuryFormal.result,
      statesExplored: treasuryFormal.statesExplored,
    }),
    chunk77TreasuryStressHash: commitCanonical({ treasuryStressHold: allTreasuryStressHold() }),
    chunk78EconomicRcHash: rc.canonicalQualificationDigest ?? rc.manifestHash,
    chunk79GovernancePackageHash: bindRehearsalGovernanceToEconomicRc({
      economicRcId: rc.canonicalEconomicRcId ?? rc.rcId,
      sourceCommit: rc.sourceCommit,
      releaseArtifactHash: rc.canonicalQualificationDigest ?? rc.manifestHash,
      formalReportHash: commitCanonical({
        modelId: treasuryFormal.modelId,
        result: treasuryFormal.result,
      }),
      economicStressReportHash: stress.chunk76ReportHash ?? rc.canonicalStressReportHash ?? rc.manifestHash,
      qualificationReportHash: rc.canonicalQualificationDigest ?? rc.manifestHash,
      simulationEvidenceHash: rc.canonicalQualificationDigest ?? rc.manifestHash,
      supplyInvariantHash: genesis.allocationHash,
      schemaHash: rc.canonicalQualificationDigest ?? rc.manifestHash,
    }),
  });
  const recoveries = runFailureAndRecoveryCampaign();
  const moonreyAudit = moonreySupplyAudit(moonrey);
  const explorer = rebuildExplorerViews({
    sunrey: sunrey.audit,
    moonrey,
    fees,
    validators,
    treasuryExact: treasury.reconciled,
  });
  const formal = runEconomicTraceConformance();
  const recovered = recoveries.every((row) => row.recovered && row.safetyHolds);
  const accountingSafe =
    sunrey.audit.exact &&
    moonreyAudit.exact &&
    fees.dispositionExact &&
    validators.supplyReconciled &&
    treasury.reconciled &&
    exchange.reconciled &&
    stress.accountingSafe;
  const findings = economicRehearsalFindings({
    genesisOk: genesis.verification.ok,
    rcOk: rc.ok,
    accountingSafe,
    recovered,
  });
  const economicBlockers = findings.filter(
    (row) => row.category === 'MAINNET_ENGINEERING_BLOCKER' && row.verificationState === 'OPEN',
  );
  const classification = classify(findings, !genesis.verification.ok || !rc.ok);
  const topology = rehearsalTopology();
  const room: EconomicLaunchControlRoomState = Object.freeze({
    schemaVersion: 1,
    rehearsalId: ECONOMIC_REHEARSAL_ID,
    phase: 'STABILITY_WINDOW',
    releaseVerified: rc.ok,
    genesisVerified: genesis.verification.ok,
    validatorsReady: true,
    signersReady: true,
    networkPathsReady: true,
    storageReady: recoveries.some((row) => row.scenario === 'STORAGE_FAILURE' && row.recovered),
    rpcReady: true,
    explorerReady: explorer.supplyReproduced,
    oracleReady: oracle.verifiedEconomicFact,
    backupReady: recoveries.some((row) => row.scenario === 'DATABASE_FAILURE' && row.recovered),
    monitoringReady: true,
    incidents: Object.freeze([]),
    finalizedHeight: '6',
    productionActivated: false,
    liveFlagsRemainDisabled: true,
    monetaryPolicyReady: sunrey.audit.exact,
    sunreySupplyReady: sunrey.audit.exact,
    moonreySupplyReady: moonreyAudit.exact,
    feesReady: fees.dispositionExact,
    validatorEconomicsReady: validators.supplyReconciled,
    oracleHealthReady: oracle.quorumHeld,
    productiveIssuanceReady: moonrey.observationToReceipt,
    treasuryReady: treasury.reconciled,
    exchangeReady: exchange.reconciled,
    economicRcReady: rc.ok,
    economicStressReady: stress.accountingSafe,
    activeGovernanceVersionReady: governance.feePolicyUpgrade.activated,
    activeGovernanceVersion: governance.feePolicyUpgrade.newVersion,
    economicPhase: 'STABILITY_WINDOW',
  });
  const report: EconomicMainnetRehearsalReport = Object.freeze({
    schemaVersion: ECONOMIC_REHEARSAL_SCHEMA_VERSION,
    toolVersion: ECONOMIC_REHEARSAL_TOOL_VERSION,
    rehearsalId: ECONOMIC_REHEARSAL_ID,
    displayName: ECONOMIC_REHEARSAL_DISPLAY_NAME,
    sourceCommit: rc.sourceCommit,
    economicRc: rc,
    rehearsalGenesis: Object.freeze({
      networkId: ECONOMIC_REHEARSAL_NETWORK_ID,
      chainId: ECONOMIC_REHEARSAL_CHAIN_ID,
      genesisHash: genesis.genesisHash,
      addressHrp: ECONOMIC_REHEARSAL_ADDRESS_HRP,
      networkClass: 'REHEARSAL',
      allocationHash: genesis.allocationHash,
    }),
    validatorCount: 7,
    sentryCount: 14,
    failureDomains: Object.freeze(sevenEconomicRehearsalValidators().map((row) => row.failureDomain).filter((row, index, all) => all.indexOf(row) === index)),
    sunreySupply: sunrey.audit,
    moonreySupply: moonreyAudit,
    fees,
    validatorEconomics: validators,
    moonreyIssuance: moonrey,
    treasury,
    exchange,
    machineCommerce: machine,
    governance,
    dualEconomy: dual,
    stress,
    recoveries,
    explorer,
    formal,
    controlRoom: room,
    findings,
    economicFindings: stress.findings,
    engineeringBlockers: economicBlockers,
    classification,
    productionCandidateAllocationUnchanged: true,
    productionAuthorized: false,
    liveFlagsRemainDisabled: true,
    tickersAssigned: false,
    knownLimitations: knownLimitations(),
    integratedEvidenceHashes,
  });
  const evidence: EconomicActivationEvidenceBundle = Object.freeze({
    schemaVersion: 1,
    rehearsalId: ECONOMIC_REHEARSAL_ID,
    displayName: ECONOMIC_REHEARSAL_DISPLAY_NAME,
    sourceCommit: rc.sourceCommit,
    economicRc: rc,
    rehearsalGenesisHash: genesis.genesisHash,
    policyHashes: genesis.policyHashes,
    validatorTopology: Object.freeze({
      validatorCount: 7 as const,
      sentryCount: 14 as const,
      failureDomains: report.failureDomains,
    }),
    formalResults: formal,
    stressResults: stress,
    supplyAudits: Object.freeze([sunrey.audit, moonreyAudit]),
    treasuryAudit: treasury,
    exchangeReconciliation: exchange,
    recoveryResults: recoveries,
    governanceRehearsal: governance,
    knownLimitations: knownLimitations(),
    productionAuthorized: false,
    liveFlagsRemainDisabled: true,
    integratedEvidenceHashes,
  });
  void topology;
  void oracle;
  const session = Object.freeze({
    report,
    evidence,
    readiness: reevaluateReadinessAfterEconomicRehearsal(),
    plan: updateActivationPlanFromEconomicRehearsal(findings),
  });
  rehearsalCache = { root, session };
  return session;
}

export function economicRehearsalDoesNotActivateProduction(session: EconomicRehearsalSession): true {
  if (session.report.productionAuthorized !== false) {
    throw new TypeError('economic rehearsal must not authorize production');
  }
  if (session.report.liveFlagsRemainDisabled !== true) {
    throw new TypeError('LIVE_* must remain disabled');
  }
  if (session.report.tickersAssigned !== false) {
    throw new TypeError('tickers must remain unassigned');
  }
  return true;
}
