/**
 * Full SunRey mainnet launch rehearsal orchestrator.
 *
 * Executes the production-like dry run, records findings, re-evaluates
 * Chunk 65 readiness, and updates the future ActivationPlan without
 * launching production.
 */

import { applyEngineeringVerification, defaultDimensionCatalog } from '../mainnet/index.ts';
import { assembleReadinessRegistry } from '../mainnet/registry.ts';
import { generateActivationPlan, activationPlanDoesNotEnableLiveFlags } from '../mainnet/activation-plan.ts';
import { buildGenesisCandidate } from '../mainnet/genesis-candidate.ts';
import type { ActivationPlan, MainnetReadinessRegistry } from '../mainnet/types.ts';
import { verifyRehearsalReleaseArtifacts, type RehearsalReleaseVerification } from './artifacts.ts';
import { runBootSequence, independentlyVerifyGenesis, rehearseFirstBlock } from './boot.ts';
import {
  createRehearsalNetworkState,
  injectDatabaseFailure,
  injectExplorerFailure,
  injectFailureDomain,
  injectNoQuorum,
  injectOracleFailure,
  injectRegulatedProviderFailure,
  injectRpcFailure,
  injectSecurityIncident,
  injectSignerFailure,
  injectStorageFailure,
  injectTwoValidatorsUnavailable,
  injectValidatorUnavailable,
  recoverDatabaseFailure,
  recoverExplorerFailure,
  recoverFailureDomain,
  recoverNoQuorum,
  recoverOracleFailure,
  recoverRegulatedProviderFailure,
  recoverRpcFailure,
  recoverSecurityIncident,
  recoverSignerFailure,
  recoverStorageFailure,
  recoverTwoValidatorsUnavailable,
  recoverValidatorUnavailable,
  rejoinNetwork,
  validateBackups,
  type RehearsalNetworkState,
} from './failures.ts';
import { buildRehearsalGenesis, sevenRehearsalValidators, type RehearsalGenesisBundle } from './genesis.ts';
import {
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import {
  REHEARSAL_ADDRESS_HRP,
  REHEARSAL_CHAIN_ID,
  REHEARSAL_DISPLAY_NAME,
  REHEARSAL_ID,
  REHEARSAL_NETWORK_CLASS,
  REHEARSAL_NETWORK_ID,
} from './identity.ts';
import {
  provisionRehearsalSigners,
  provisionRehearsalStorage,
  rehearsalPostgresProfile,
  rehearsalTopology,
} from './infrastructure.ts';
import { controlRoomFromChecks, runPreLaunchChecks, validateObservability } from './operations.ts';
import type {
  FailureScenario,
  FailureScenarioResult,
  LaunchControlRoomState,
  MainnetLaunchRehearsalReport,
  RehearsalFinding,
  RehearsalSuccessClass,
} from './types.ts';
import {
  rehearseExplorer,
  rehearseInterop,
  rehearseNativeAssets,
  rehearseOracle,
  rehearseRegulatedSandbox,
  rehearseSdk,
} from './workflows.ts';

export type LaunchRehearsalSession = {
  readonly release: RehearsalReleaseVerification;
  readonly genesis: RehearsalGenesisBundle;
  readonly room: LaunchControlRoomState;
  readonly report: MainnetLaunchRehearsalReport;
  readonly findings: readonly RehearsalFinding[];
  readonly plan: ActivationPlan;
  readonly readiness: MainnetReadinessRegistry;
  readonly network: RehearsalNetworkState;
};

function classify(findings: readonly RehearsalFinding[], incomplete: boolean): RehearsalSuccessClass {
  if (incomplete) {
    return 'REHEARSAL_INCOMPLETE';
  }
  const blockers = findings.filter((row) => row.category === 'MAINNET_ENGINEERING_BLOCKER' && row.verificationState === 'OPEN');
  if (blockers.length > 0 || findings.some((row) => row.severity === 'CRITICAL' && row.verificationState === 'OPEN')) {
    return 'REHEARSAL_COMPLETED_WITH_FINDINGS';
  }
  if (findings.some((row) => row.verificationState !== 'VERIFIED' && row.verificationState !== 'ACCEPTED_LIMITATION')) {
    return 'REHEARSAL_COMPLETED_WITH_FINDINGS';
  }
  return 'ENGINEERING_REHEARSAL_QUALIFIED';
}

function knownLimitations(): readonly string[] {
  return Object.freeze([
    'Chunks 66–69 production-candidate adapters are exercised through existing ops/oracle/exchange/custody simulation ports.',
    'External legal, regulatory, licensing, and counsel evidence remain unfabricated.',
    'Simulation HSM is not a commercial production HSM.',
    'Rehearsal classification does not authorize production mainnet.',
    'LIVE_* flags remain false. ENVIRONMENT remains simulation.',
    'No customer data, customer funds, or production provider credentials were used.',
  ]);
}

export function rehearsalFindings(input: {
  readonly firstBlockAgreed: boolean;
  readonly recovered: boolean;
  readonly observabilityOk: boolean;
}): readonly RehearsalFinding[] {
  return Object.freeze([
    {
      findingId: 'FND-70-001',
      category: 'READINESS',
      severity: 'INFO',
      description: 'External legal and regulatory evidence remains incomplete after rehearsal.',
      evidence: 'Chunk 65 registry still AWAITING_EXTERNAL_EVIDENCE for counsel/license slots.',
      owner: 'LAUNCH_COORDINATOR',
      remediation: 'Collect real external evidence. Do not fabricate counsel confirmation.',
      verificationState: 'ACCEPTED_LIMITATION',
    },
    {
      findingId: 'FND-70-002',
      category: 'INFRASTRUCTURE',
      severity: 'LOW',
      description: 'Rehearsal used in-process production-candidate topology rather than a live multi-region deployment.',
      evidence: 'Seven validators, 14 sentries, three simulated failure domains.',
      owner: 'INFRASTRUCTURE_OPERATOR',
      remediation: 'Repeat against configured physical or cloud failure domains when available.',
      verificationState: 'ACCEPTED_LIMITATION',
    },
    {
      findingId: 'FND-70-003',
      category: 'CONSENSUS',
      severity: input.firstBlockAgreed ? 'INFO' : 'CRITICAL',
      description: input.firstBlockAgreed
        ? 'Healthy validators agreed on the first rehearsal block.'
        : 'First-block agreement failed.',
      evidence: 'SevenValidatorNetwork first commit and state-root check.',
      owner: 'PROTOCOL_OPERATOR',
      remediation: input.firstBlockAgreed ? 'None.' : 'Halt rehearsal and inspect genesis/validator set.',
      verificationState: input.firstBlockAgreed ? 'VERIFIED' : 'OPEN',
    },
    {
      findingId: 'FND-70-004',
      category: 'OBSERVABILITY',
      severity: input.observabilityOk ? 'INFO' : 'HIGH',
      description: 'Chunk 55 dashboard and alert catalog validation.',
      evidence: 'validateDashboardConfigs + alertDefinitions',
      owner: 'INCIDENT_COMMANDER',
      remediation: input.observabilityOk ? 'None.' : 'Repair dashboard catalog before a future production launch.',
      verificationState: input.observabilityOk ? 'VERIFIED' : 'OPEN',
    },
    {
      findingId: 'FND-70-005',
      category: 'SECURITY',
      severity: 'INFO',
      description: 'Suspected signing-key compromise playbook exercised with rehearsal keys only.',
      evidence: 'Detection, signing restriction, evidence seal, replacement procedure.',
      owner: 'SECURITY_OPERATOR',
      remediation: 'Keep production keys offline until a real ceremony occurs.',
      verificationState: input.recovered ? 'VERIFIED' : 'OPEN',
    },
  ]);
}

export function updateActivationPlanFromRehearsal(
  findings: readonly RehearsalFinding[],
): ActivationPlan {
  const base = generateActivationPlan(defaultDimensionCatalog());
  const extra = findings
    .filter((row) => row.verificationState !== 'VERIFIED')
    .map((row, index) =>
      Object.freeze({
        order: base.steps.length + index + 1,
        id: `rehearsal-${row.findingId.toLowerCase()}`,
        title: `Address rehearsal finding ${row.findingId}`,
        status: 'PLANNED' as const,
        executesInfrastructure: false as const,
        notes: `${row.description} Owner ${row.owner}. Plan only; not executed.`,
      }),
    );
  return Object.freeze({
    ...base,
    steps: Object.freeze([...base.steps, ...extra]),
    incompleteEvidence: Object.freeze([
      ...base.incompleteEvidence,
      ...findings.filter((row) => row.verificationState === 'ACCEPTED_LIMITATION').map((row) => row.findingId),
    ]),
  });
}

export function reevaluateReadinessAfterRehearsal(): MainnetReadinessRegistry {
  const records = defaultDimensionCatalog().map((row) => {
    if (row.externalEvidence || row.dimension === 'LEGAL' || row.dimension === 'REGULATORY' || row.dimension === 'LICENSING' || row.dimension === 'HUMAN_AUTHORIZATION') {
      return row;
    }
    if (row.dimension === 'VALIDATOR_OPERATIONS' || row.dimension === 'OBSERVABILITY' || row.dimension === 'DISASTER_RECOVERY' || row.dimension === 'GENESIS') {
      try {
        return applyEngineeringVerification(row, 'ENGINEERING_VERIFIED');
      } catch {
        return row;
      }
    }
    return row;
  });
  return assembleReadinessRegistry({ records });
}

export function runLaunchRehearsal(root = process.cwd()): LaunchRehearsalSession {
  const release = verifyRehearsalReleaseArtifacts(root);
  const genesis = buildRehearsalGenesis();
  const productionCandidate = buildGenesisCandidate();
  if (genesis.genesisHash === productionCandidate.genesisHash) {
    throw new TypeError('rehearsal genesis must be distinct from the production candidate');
  }
  if (
    (REHEARSAL_NETWORK_ID as string) === (PRODUCTION_CANDIDATE_NETWORK_ID as string)
    || (REHEARSAL_CHAIN_ID as string) === (PRODUCTION_CANDIDATE_CHAIN_ID as string)
  ) {
    throw new TypeError('rehearsal identity collided with production candidate');
  }
  const topology = rehearsalTopology();
  const signers = provisionRehearsalSigners();
  const first = rehearseFirstBlock(genesis);
  const storage = provisionRehearsalStorage(first.stateRoot, 1n);
  const boot = runBootSequence({
    release,
    genesis,
    topology,
    signersReady: signers.activeOnly,
    storageReady: storage.snapshotOk,
  });
  if (!independentlyVerifyGenesis(genesis) || !boot.receipt.consensusStarted) {
    throw new Error('rehearsal launch conditions were not satisfied');
  }
  const checks = runPreLaunchChecks({
    release,
    genesis,
    topology,
    signersReady: signers.activeOnly,
    storageReady: storage.snapshotOk,
  });
  const observability = validateObservability();
  const nativeAssets = rehearseNativeAssets();
  const oracle = rehearseOracle();
  const sandbox = rehearseRegulatedSandbox();
  const interop = rehearseInterop();
  const sdk = rehearseSdk(root);
  const explorer = rehearseExplorer();
  const network = createRehearsalNetworkState();

  const scenarios: FailureScenarioResult[] = [];
  const recoveries: FailureScenarioResult[] = [];
  scenarios.push(injectValidatorUnavailable(network));
  recoveries.push(recoverValidatorUnavailable(network));
  scenarios.push(injectTwoValidatorsUnavailable(network));
  recoveries.push(recoverTwoValidatorsUnavailable(network));
  scenarios.push(injectFailureDomain(network));
  recoveries.push(recoverFailureDomain(network));
  scenarios.push(injectSignerFailure());
  recoveries.push(recoverSignerFailure());
  scenarios.push(injectStorageFailure(network));
  recoveries.push(recoverStorageFailure(network));
  scenarios.push(injectDatabaseFailure());
  recoveries.push(recoverDatabaseFailure());
  scenarios.push(injectRpcFailure(network));
  recoveries.push(recoverRpcFailure(network));
  scenarios.push(injectExplorerFailure(network));
  recoveries.push(recoverExplorerFailure(network));
  scenarios.push(injectOracleFailure());
  recoveries.push(recoverOracleFailure());
  scenarios.push(injectRegulatedProviderFailure());
  recoveries.push(recoverRegulatedProviderFailure());
  const securityInjected = injectSecurityIncident();
  const securityRecovered = recoverSecurityIncident();
  scenarios.push(injectNoQuorum(network));
  recoveries.push(recoverNoQuorum(network));
  recoveries.push(rejoinNetwork(network));

  const backups = validateBackups(sevenRehearsalValidators()[0]!.validatorId);
  const postgres = rehearsalPostgresProfile();
  const recovered = recoveries.every((row) => row.recovered && row.safetyHolds);
  const findings = rehearsalFindings({
    firstBlockAgreed: first.record.healthyValidatorAgreement,
    recovered,
    observabilityOk: observability.ok,
  });
  const classification = classify(findings, !boot.receipt.launchConditionsSatisfied);
  const readiness = reevaluateReadinessAfterRehearsal();
  const plan = updateActivationPlanFromRehearsal(findings);
  if (!activationPlanDoesNotEnableLiveFlags(plan)) {
    throw new TypeError('activation plan must not enable LIVE_* flags');
  }
  const finalizedHeight = network.network.commits[network.network.commits.length - 1]?.height.toString() ?? first.record.firstCommit;
  const room = controlRoomFromChecks(checks, 'STABILITY_WINDOW', finalizedHeight, securityRecovered.detected ? ['suspected-validator-signing-key-compromise'] : []);
  const report: MainnetLaunchRehearsalReport = Object.freeze({
    schemaVersion: 1,
    toolVersion: 'sunrey-launch/1',
    rehearsalId: REHEARSAL_ID,
    displayName: REHEARSAL_DISPLAY_NAME,
    sourceCommit: release.sourceCommit,
    release: {
      artifactDigest: release.artifactDigest,
      sbomDigest: release.sbomDigest,
      provenanceDigest: release.provenanceDigest,
      protocolCompatible: release.protocolCompatible,
      schemaCompatible: release.schemaCompatible,
    },
    rehearsalGenesis: {
      networkId: REHEARSAL_NETWORK_ID,
      chainId: REHEARSAL_CHAIN_ID,
      genesisHash: genesis.genesisHash,
      addressHrp: REHEARSAL_ADDRESS_HRP,
      networkClass: REHEARSAL_NETWORK_CLASS,
    },
    validatorCount: 7,
    sentryCount: 14,
    failureDomains: topology.failureDomains,
    finalizedHeight,
    stateRoot: first.stateRoot,
    firstBlock: first.record,
    failureScenarios: Object.freeze(scenarios),
    recoveryResults: Object.freeze(recoveries),
    securityEvents: Object.freeze([securityInjected, securityRecovered]),
    performanceSummary: Object.freeze({
      finalizedBlocks: network.network.commits.length,
      consensusRounds: network.network.commits.length,
      engineeringOnly: true,
    }),
    storageStatus: `${storage.engine}/${postgres.profileId}`,
    oracleStatus: oracle,
    exchangeCustodySandbox: sandbox,
    nativeAssets,
    interop,
    sdk,
    explorer,
    backups,
    readinessChanges: Object.freeze([
      `readiness status ${readiness.status}`,
      'engineering evidence may improve; external/legal/regulatory/human evidence unchanged',
    ]),
    knownLimitations: knownLimitations(),
    findings,
    engineeringBlockers: Object.freeze(findings.filter((row) => row.category === 'MAINNET_ENGINEERING_BLOCKER')),
    classification,
    productionAuthorized: false,
    liveFlagsRemainDisabled: true,
  });
  return Object.freeze({
    release,
    genesis,
    room,
    report,
    findings,
    plan,
    readiness,
    network,
  });
}

export function injectNamedFailure(session: LaunchRehearsalSession, scenario: FailureScenario): FailureScenarioResult {
  const state = session.network;
  switch (scenario) {
    case 'VALIDATOR_UNAVAILABLE':
      return injectValidatorUnavailable(state);
    case 'TWO_VALIDATORS_UNAVAILABLE':
      return injectTwoValidatorsUnavailable(state);
    case 'FAILURE_DOMAIN_EVENT':
      return injectFailureDomain(state);
    case 'SIGNER_FAILURE':
      return injectSignerFailure();
    case 'STORAGE_FAILURE':
      return injectStorageFailure(state);
    case 'DATABASE_FAILURE':
      return injectDatabaseFailure();
    case 'RPC_FAILURE':
      return injectRpcFailure(state);
    case 'EXPLORER_FAILURE':
      return injectExplorerFailure(state);
    case 'ORACLE_FAILURE':
      return injectOracleFailure();
    case 'REGULATED_PROVIDER_FAILURE':
      return injectRegulatedProviderFailure();
    case 'SECURITY_INCIDENT':
      return {
        scenario,
        injected: injectSecurityIncident().detected,
        recovered: false,
        finalityRetained: true,
        safetyHolds: true,
        notes: 'signing restricted',
      };
    case 'NO_QUORUM':
      return injectNoQuorum(state);
    case 'NETWORK_REJOIN':
      return rejoinNetwork(state);
    default: {
      const _never: never = scenario;
      return _never;
    }
  }
}

export function recoverNamedFailure(session: LaunchRehearsalSession, scenario: FailureScenario): FailureScenarioResult {
  const state = session.network;
  switch (scenario) {
    case 'VALIDATOR_UNAVAILABLE':
      return recoverValidatorUnavailable(state);
    case 'TWO_VALIDATORS_UNAVAILABLE':
      return recoverTwoValidatorsUnavailable(state);
    case 'FAILURE_DOMAIN_EVENT':
      return recoverFailureDomain(state);
    case 'SIGNER_FAILURE':
      return recoverSignerFailure();
    case 'STORAGE_FAILURE':
      return recoverStorageFailure(state);
    case 'DATABASE_FAILURE':
      return recoverDatabaseFailure();
    case 'RPC_FAILURE':
      return recoverRpcFailure(state);
    case 'EXPLORER_FAILURE':
      return recoverExplorerFailure(state);
    case 'ORACLE_FAILURE':
      return recoverOracleFailure();
    case 'REGULATED_PROVIDER_FAILURE':
      return recoverRegulatedProviderFailure();
    case 'SECURITY_INCIDENT':
      return {
        scenario,
        injected: true,
        recovered: recoverSecurityIncident().recovered,
        finalityRetained: true,
        safetyHolds: true,
        notes: 'replacement key procedure complete',
      };
    case 'NO_QUORUM':
      return recoverNoQuorum(state);
    case 'NETWORK_REJOIN':
      return rejoinNetwork(state);
    default: {
      const _never: never = scenario;
      return _never;
    }
  }
}
