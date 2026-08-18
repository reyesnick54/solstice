/**
 * Deterministic post-genesis rehearsal simulator.
 *
 * Isolated rehearsal assets and providers only. Does not activate real
 * production capabilities.
 */

import {
  assembleActivationPackage,
  evidenceFor,
  fillEvidence,
} from './capabilities.ts';
import {
  databaseIssue,
  feeSpike,
  healthyObservation,
  oracleDegraded,
  storagePressure,
  validatorLoss,
} from './health.ts';
import { defaultPostGenesisPolicy } from './identity.ts';
import {
  activateCapability,
  advancePhase,
  applyObservation,
  attemptEarlyActivation,
  genesisLeavesCapabilitiesDisabled,
  historicFinalizedUnchanged,
  initialStabilizationState,
  recordCheckpoint,
  restrictCapability,
  type StabilizationState,
} from './plane.ts';
import { buildStabilizationReport } from './report.ts';
import type { IndependentCapability, ProductionStabilizationReport } from './types.ts';
import { POST_GENESIS_PHASES } from './types.ts';

export const REHEARSAL_SCENARIOS = [
  'healthy-first-epochs',
  'validator-loss',
  'oracle-degradation',
  'fee-spike',
  'database-issue',
  'storage-pressure',
  'exchange-kept-disabled',
  'attempted-early-custody',
  'attempted-early-fiat',
] as const;
export type RehearsalScenario = (typeof REHEARSAL_SCENARIOS)[number];

export type PostGenesisRehearsalResult = {
  readonly scenario: RehearsalScenario;
  readonly deterministic: true;
  readonly isolatedAssets: true;
  readonly isolatedProviders: true;
  readonly report: ProductionStabilizationReport;
  readonly negatives: Readonly<Record<string, boolean>>;
  readonly realProductionCapabilitiesActivated: false;
};

export function runPostGenesisRehearsal(scenario: RehearsalScenario = 'healthy-first-epochs'): PostGenesisRehearsalResult {
  let state = walkHealthyEpochs(initialStabilizationState(defaultPostGenesisPolicy()));
  let extraNegatives: Record<string, boolean> = {};

  if (scenario === 'validator-loss') {
    state = applyObservation(state, validatorLoss(healthyObservation(), 'val_rehearsal_1'));
  }
  if (scenario === 'oracle-degradation') {
    state = applyObservation(state, oracleDegraded(healthyObservation()));
  }
  if (scenario === 'fee-spike') {
    state = applyObservation(state, feeSpike(healthyObservation()));
  }
  if (scenario === 'database-issue') {
    state = applyObservation(state, databaseIssue(healthyObservation()));
  }
  if (scenario === 'storage-pressure') {
    state = applyObservation(state, storagePressure(healthyObservation(), 1024n));
  }
  if (scenario === 'exchange-kept-disabled') {
    const attempt = attemptEarlyActivation(state, 'SUNREY_EXCHANGE');
    state = attempt.state;
    extraNegatives.exchangeKeptDisabled = attempt.result.outcome === 'REJECTED' && !state.enabled.has('SUNREY_EXCHANGE');
  }
  if (scenario === 'attempted-early-custody') {
    const attempt = attemptEarlyActivation(state, 'INSTITUTIONAL_CUSTODY');
    state = attempt.state;
    extraNegatives.earlyCustodyRejected = attempt.result.reasons.includes('custody activation without HSM evidence rejected');
  }
  if (scenario === 'attempted-early-fiat') {
    const attempt = attemptEarlyActivation(state, 'FIAT_BANKING');
    state = attempt.state;
    extraNegatives.earlyFiatRejected = attempt.result.reasons.includes('fiat activation without banking evidence rejected');
  }

  const report = buildStabilizationReport(state);
  return Object.freeze({
    scenario,
    deterministic: true,
    isolatedAssets: true,
    isolatedProviders: true,
    report,
    negatives: Object.freeze({
      genesisDoesNotEnableCapabilities: genesisLeavesCapabilitiesDisabled(walkHealthyEpochs(initialStabilizationState())),
      historicFinalizedUnchanged: historicFinalizedUnchanged(state),
      ...extraNegatives,
    }),
    realProductionCapabilitiesActivated: false,
  });
}

export function runAllPostGenesisRehearsals(): readonly PostGenesisRehearsalResult[] {
  return Object.freeze(REHEARSAL_SCENARIOS.map((scenario) => runPostGenesisRehearsal(scenario)));
}

export function walkHealthyEpochs(state: StabilizationState): StabilizationState {
  const roots = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'dddddddd'] as const;
  const heights = state.policy.checkpointHeights;
  let next = state;
  for (const [index, height] of heights.entries()) {
    next = recordCheckpoint(next, {
      height,
      epoch: Math.min(index, 2),
      finalizedStateRoot: roots[index] ?? `eeeeeee${index}`,
      observation: healthyObservation(),
    });
    if (index < POST_GENESIS_PHASES.length - 1) {
      next = advancePhase(next, POST_GENESIS_PHASES[index + 1] ?? next.phase);
    }
  }
  return next;
}

export function runNegativeActivationSuite(): Readonly<Record<string, CapabilityActivationResultLike>> {
  const policy = defaultPostGenesisPolicy();
  let state = walkHealthyEpochs(initialStabilizationState(policy));

  const exchange = activateCapability(state, assembleActivationPackage({ capability: 'SUNREY_EXCHANGE', policy }));
  state = exchange.state;
  const custody = activateCapability(state, assembleActivationPackage({ capability: 'INSTITUTIONAL_CUSTODY', policy }));
  state = custody.state;
  const fiat = activateCapability(state, assembleActivationPackage({ capability: 'FIAT_BANKING', policy }));
  state = fiat.state;
  const him = activateCapability(state, assembleActivationPackage({ capability: 'HUMAN_INFORMATION_MARKET', policy }));
  state = him.state;
  const wrongNetwork = activateCapability(
    state,
    assembleActivationPackage({ capability: 'SUNREY_COIN_NATIVE_ASSET', policy, networkId: 'net_wrong' }),
  );
  state = wrongNetwork.state;
  const firstCoin = activateCapability(
    state,
    assembleActivationPackage({
      capability: 'SUNREY_COIN_NATIVE_ASSET',
      policy,
      humanAuthority: [human()],
    }),
  );
  state = firstCoin.state;
  const replay = activateCapability(
    state,
    assembleActivationPackage({
      capability: 'SUNREY_COIN_NATIVE_ASSET',
      policy,
      humanAuthority: [human()],
    }),
  );
  state = replay.state;
  const ai = attemptEarlyActivation(state, 'MOONREY_COIN_NATIVE_ASSET', 'AI');
  state = ai.state;
  const bypass = restrictCapability(state, 'SUNREY_EXCHANGE', 'REWRITE_FINALIZED_BLOCKS');

  return Object.freeze({
    exchangeWithoutEvidence: exchange.result,
    custodyWithoutHsm: custody.result,
    fiatWithoutBanking: fiat.result,
    himWithoutPrivacy: him.result,
    wrongNetwork: wrongNetwork.result,
    replayedPackage: replay.result,
    aiActivation: ai.result,
    restrictionBypass: { outcome: bypass.ok ? 'ACTIVATED' : 'REJECTED', reasons: [bypass.reason] },
    genesisLeavesDisabled: { outcome: genesisLeavesCapabilitiesDisabled(walkHealthyEpochs(initialStabilizationState())) ? 'REJECTED' : 'ACTIVATED', reasons: ['mainnet genesis does not automatically enable capabilities'] },
  });
}

type CapabilityActivationResultLike = {
  readonly outcome: string;
  readonly reasons: readonly string[];
};

function human() {
  return {
    actorKind: 'HUMAN' as const,
    actorId: 'human-rehearsal',
    role: 'PROTOCOL_AUTHORITY',
    statement: 'rehearsal native-asset package',
    signedAtUtc: '2026-08-18T00:00:00.000Z',
    accepted: true,
  };
}

export function filledPackage(capability: IndependentCapability) {
  let evidence = evidenceFor(capability);
  const slots = [
    ...evidence.legal,
    ...evidence.regulatory,
    ...evidence.security,
    ...evidence.operations,
    ...evidence.providers,
    ...evidence.human,
    ...evidence.privacy,
  ];
  for (const slot of slots) {
    if (slot.required && slot.state === 'NOT_PROVIDED') {
      evidence = fillEvidence(evidence, slot.slotId, 'HUMAN_VERIFIED');
    }
  }
  return assembleActivationPackage({
    capability,
    evidence,
    humanAuthority: [human()],
  });
}
