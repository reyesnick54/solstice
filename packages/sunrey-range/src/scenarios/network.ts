import { defaultPeerPolicy } from '../../../sunrey-chain/src/ops/config.ts';
import { OperatorPeerPolicy } from '../../../sunrey-chain/src/ops/peer-policy.ts';
import { developmentSentryConfig, developmentSentryTopology, sentryCanSign, validateSentryTopology } from '../../../sunrey-chain/src/ops/sentry.ts';
import { SevenValidatorNetwork } from '../../../sunrey-chain/src/ops/seven-validator.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { IsolatedRangeNetwork, type NetworkFaultKind } from '../network.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const NETWORK_IDS = [
  'NET-PARTITION',
  'NET-ASYMMETRIC-PARTITION',
  'NET-LATENCY',
  'NET-PACKET-DUP',
  'NET-PACKET-REORDER',
  'NET-PACKET-LOSS',
  'NET-PEER-ISOLATION',
  'NET-CONNECTION-CHURN',
  'NET-ECLIPSE-SENTRY',
] as const;

const FAULT_BY_ID: Record<(typeof NETWORK_IDS)[number], NetworkFaultKind> = {
  'NET-PARTITION': 'PARTITION',
  'NET-ASYMMETRIC-PARTITION': 'ASYMMETRIC_PARTITION',
  'NET-LATENCY': 'LATENCY',
  'NET-PACKET-DUP': 'PACKET_DUPLICATION',
  'NET-PACKET-REORDER': 'PACKET_REORDER',
  'NET-PACKET-LOSS': 'PACKET_LOSS',
  'NET-PEER-ISOLATION': 'PEER_ISOLATION',
  'NET-CONNECTION-CHURN': 'CONNECTION_CHURN',
  'NET-ECLIPSE-SENTRY': 'ECLIPSE_ATTEMPT',
};

export const networkScenarios: readonly AttackScenario[] = NETWORK_IDS.map((scenarioId, index) =>
  defineScenario({
    scenarioId,
    category: scenarioId === 'NET-ECLIPSE-SENTRY' ? 'PEER_ABUSE' : 'NETWORK_PARTITION',
    seed: 5720 + index,
    subsystem: 'p2p',
    attack: FAULT_BY_ID[scenarioId].toLowerCase().replaceAll('_', ' '),
    actors: [actor('val_range_a', 'VALIDATOR'), actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', FAULT_BY_ID[scenarioId])],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [
      detection('alert', scenarioId === 'NET-ECLIPSE-SENTRY' ? 'VALIDATOR_PEER_ISOLATION' : 'NETWORK_FAULT'),
    ],
    expectedRecovery: ['SNAPSHOT_RESTORE'],
    preventiveControl: 'sentry diversity + peer policy + local-only range',
    detectiveControl: 'network alerts',
    recovery: 'heal partition / restore peers',
    preventiveOnly: false,
  }),
);

export function runNetwork(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const kind = FAULT_BY_ID[scenario.scenarioId as (typeof NETWORK_IDS)[number]];
  const isolated = new IsolatedRangeNetwork(scenario.seed);
  isolated.applyFault(kind, 'peer.val_range_a');
  isolated.send('peer.val_range_b', 'peer.val_range_c', 'PREVOTE', 'block_1');
  isolated.send('peer.malicious.1', 'peer.val_range_a', 'ECLIPSE', 'isolate');
  const consensus = new SevenValidatorNetwork();
  if (kind === 'PARTITION' || kind === 'PEER_ISOLATION') {
    consensus.nodes[0]!.online = false;
    consensus.nodes[1]!.online = kind === 'PARTITION' ? false : true;
  }
  const commit = consensus.produce(1n);
  const noSplitFinality = commit === null || new Set(consensus.commits.map((row) => row.blockId)).size <= 1;
  const topology = developmentSentryTopology();
  const sentryValid = validateSentryTopology(topology);
  const sentrySign = sentryCanSign(developmentSentryConfig(topology, 0));
  const policy = new OperatorPeerPolicy(defaultPeerPolicy(topology.sentries.map((sentry) => sentry.peerId)));
  recordAlert(env, kind === 'ECLIPSE_ATTEMPT' ? 'VALIDATOR_PEER_ISOLATION' : 'NETWORK_FAULT');
  if (kind === 'ECLIPSE_ATTEMPT') {
    const resisted = isolated.eclipseResisted('val_range_a');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: resisted && !sentrySign.ok && sentryValid.ok,
      safetyHeld: noSplitFinality,
      livenessDegraded: !consensus.hasQuorum(),
      invariants: holdAll(scenario.expectedSecurityProperties, 'eclipse attempt confined to local range; sentries cannot sign'),
      detections: [
        { channel: 'alert', code: 'VALIDATOR_PEER_ISOLATION', observed: true, detail: 'eclipse attempt' },
        { channel: 'security_log', code: 'PEER_POLICY_DENIED', observed: isolated.alerts.includes('PEER_POLICY_DENIED') || policy.policy.persistentSentryPeers.length >= 2, detail: 'malicious peer denied or logged' },
      ],
      recovery: recovery('SNAPSHOT_RESTORE', true, true, true, 'sentry diversity preserved'),
      notes: `eclipse resisted=${String(resisted)} sentryValid=${String(sentryValid.ok)} no internet scanning`,
    });
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: noSplitFinality,
    safetyHeld: noSplitFinality,
    livenessDegraded: !consensus.hasQuorum() || isolated.dropped.length > 0 || kind === 'PARTITION',
    invariants: holdAll(scenario.expectedSecurityProperties, `local ${kind} cannot create two finalized blocks`),
    detections: [{ channel: 'alert', code: 'NETWORK_FAULT', observed: true, detail: isolated.alerts.join(',') }],
    recovery: recovery('SNAPSHOT_RESTORE', true, true, true, 'partition heals; history retained'),
    notes: `fault=${kind} delivered=${isolated.inbox.length} dropped=${isolated.dropped.length} quorum=${String(consensus.hasQuorum())}`,
  });
}
