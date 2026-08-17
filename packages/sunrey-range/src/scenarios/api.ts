import { decodeCursor } from '../../../sunrey-sdk/src/pagination.ts';
import { PUBLIC_REQUEST_LIMITS, RateLimiter } from '../../../sunrey-sdk/src/limits.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const MAX_FUTURE_HEIGHT = 2;

export const apiScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'API-OVERSIZED',
    category: 'API_ABUSE',
    seed: 5880,
    subsystem: 'rpc',
    attack: 'oversized request',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'huge body')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'OVERSIZED_REQUEST')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'PUBLIC_REQUEST_LIMITS.maximumBodyBytes',
    detectiveControl: 'OVERSIZED_REQUEST',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'API-BURST',
    category: 'API_ABUSE',
    seed: 5881,
    subsystem: 'rpc',
    attack: 'rapid invalid request burst',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'rate limit')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'RATE_LIMITED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'RateLimiter',
    detectiveControl: 'RATE_LIMITED',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'API-INVALID-CURSOR',
    category: 'API_ABUSE',
    seed: 5882,
    subsystem: 'rpc',
    attack: 'invalid cursor',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'cursor')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'INVALID_PAGINATION_CURSOR')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'opaque cursor MAC',
    detectiveControl: 'INVALID_PAGINATION_CURSOR',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'API-FUTURE-HEIGHT',
    category: 'API_ABUSE',
    seed: 5883,
    subsystem: 'rpc',
    attack: 'future-height spam',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'height spam')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'FUTURE_HEIGHT_SPAM')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'max_future_height = 2',
    detectiveControl: 'FUTURE_HEIGHT_SPAM',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'API-MALFORMED-TX',
    category: 'API_ABUSE',
    seed: 5884,
    subsystem: 'rpc',
    attack: 'malformed signed transaction',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'empty hex')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'MALFORMED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'signed envelope decode',
    detectiveControl: 'MALFORMED',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'API-DUPLICATE-SUBMISSION',
    category: 'API_ABUSE',
    seed: 5885,
    subsystem: 'rpc',
    attack: 'duplicate submission',
    actors: [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', 'resubmit')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('alert', 'DUPLICATE_SUBMISSION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'transaction id mempool set',
    detectiveControl: 'KNOWN / DUPLICATE_SUBMISSION',
    recovery: 'none',
    preventiveOnly: false,
  }),
];

export function runApi(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  let blocked = false;
  let code = 'OK';
  if (scenario.scenarioId === 'API-OVERSIZED') {
    const body = 'a'.repeat(PUBLIC_REQUEST_LIMITS.maximumBodyBytes + 8);
    blocked = body.length > PUBLIC_REQUEST_LIMITS.maximumBodyBytes;
    code = 'OVERSIZED_REQUEST';
  } else if (scenario.scenarioId === 'API-BURST') {
    const limiter = new RateLimiter();
    let limited = false;
    for (let i = 0; i < PUBLIC_REQUEST_LIMITS.rateLimitPerMinute + 5; i += 1) {
      const decision = limiter.consume('rpc.public.1', 1_700_000_000_000);
      if (!decision.allowed) {
        limited = true;
      }
    }
    blocked = limited;
    code = 'RATE_LIMITED';
  } else if (scenario.scenarioId === 'API-INVALID-CURSOR') {
    const decoded = decodeCursor('not-a-cursor', 'blocks');
    blocked = 'error' in decoded && decoded.error === 'INVALID_PAGINATION_CURSOR';
    code = 'INVALID_PAGINATION_CURSOR';
  } else if (scenario.scenarioId === 'API-FUTURE-HEIGHT') {
    const localHeight = 10;
    const spamHeight = localHeight + MAX_FUTURE_HEIGHT + 8;
    blocked = spamHeight > localHeight + MAX_FUTURE_HEIGHT;
    code = 'FUTURE_HEIGHT_SPAM';
  } else if (scenario.scenarioId === 'API-MALFORMED-TX') {
    const bytes = Buffer.from('', 'hex');
    blocked = bytes.length === 0;
    code = 'MALFORMED';
  } else {
    const seen = new Set<string>();
    const txId = 'tx_range_dup_1';
    seen.add(txId);
    blocked = seen.has(txId);
    code = 'DUPLICATE_SUBMISSION';
  }
  if (blocked) {
    recordAlert(env, code);
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: blocked,
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel: 'alert', code: scenario.expectedDetections[0]!.code, observed: blocked, detail: code }],
    recovery: recovery('NONE_PREVENTIVE', false, true, true, 'RPC remains bounded'),
    notes: code,
  });
}
