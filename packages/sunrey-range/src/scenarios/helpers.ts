import { held, type SecurityInvariantId } from '../invariants.ts';
import type {
  AttackResult,
  AttackScenario,
  CampaignSeverity,
  DetectionResult,
  ExpectedDetection,
  RangeActor,
  RangeFault,
  RangeInitialState,
  RangeTimelineStep,
  RecoveryKind,
  RecoveryResult,
  SecurityInvariantResult,
} from '../types.ts';
import { RANGE_FIXTURE_VERSION } from '../types.ts';

export const INITIAL_STATE: RangeInitialState = Object.freeze({
  networkId: 'net_sunrey_range_dev',
  chainId: 'chn_sunrey_range_dev',
  validatorCount: 7,
  testCredentialsOnly: true,
});

export function actor(actorId: string, role: RangeActor['role'], adversarial = false, votingPower?: bigint): RangeActor {
  return votingPower === undefined
    ? { actorId, role, adversarial }
    : { actorId, role, adversarial, votingPower };
}

export function fault(faultId: string, kind: string, targetId: string, detail: string): RangeFault {
  return { faultId, kind, targetId, detail };
}

export function step(atTick: number, actorId: string, action: string): RangeTimelineStep {
  return { atTick, actorId, action };
}

export function detection(channel: ExpectedDetection['channel'], code: string, required = true): ExpectedDetection {
  return { channel, code, required };
}

export function defineScenario(
  input: Omit<AttackScenario, 'initialState' | 'version' | 'fixtureVersion'> & {
    readonly version?: number;
    readonly fixtureVersion?: string;
  },
): AttackScenario {
  return Object.freeze({
    ...input,
    version: input.version ?? 1,
    fixtureVersion: input.fixtureVersion ?? RANGE_FIXTURE_VERSION,
    initialState: INITIAL_STATE,
  });
}

export function observed(channel: DetectionResult['channel'], code: string, seen: boolean, detail: string): DetectionResult {
  return { channel, code, observed: seen, detail };
}

export function recovery(
  kind: RecoveryKind,
  attempted: boolean,
  succeeded: boolean,
  historicalEvidencePreserved: boolean,
  detail: string,
): RecoveryResult {
  return { kind, attempted, succeeded, historicalEvidencePreserved, detail };
}

export function finish(input: {
  readonly scenario: AttackScenario;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly attackBlocked: boolean;
  readonly safetyHeld: boolean;
  readonly livenessDegraded?: boolean;
  readonly invariants: readonly SecurityInvariantResult[];
  readonly detections: readonly DetectionResult[];
  readonly recovery: RecoveryResult;
  readonly notes: string;
}): AttackResult {
  const invariantsHeld = input.invariants.every((row) => row.held);
  const requiredDetections = input.scenario.expectedDetections.filter((row) => row.required);
  const detectionsMet =
    input.scenario.preventiveOnly ||
    requiredDetections.every((expected) =>
      input.detections.some((row) => row.channel === expected.channel && row.code === expected.code && row.observed),
    );
  const passed = input.attackBlocked && input.safetyHeld && invariantsHeld && detectionsMet && input.recovery.historicalEvidencePreserved;
  const severity = campaignSeverity({
    safetyHeld: input.safetyHeld && invariantsHeld,
    livenessDegraded: input.livenessDegraded ?? false,
  });
  return {
    scenarioId: input.scenario.scenarioId,
    version: input.scenario.version,
    seed: input.scenario.seed,
    fixtureVersion: input.scenario.fixtureVersion,
    sourceCommit: input.sourceCommit,
    testnetGenesis: input.testnetGenesis,
    attackBlocked: input.attackBlocked,
    safetyHeld: input.safetyHeld,
    livenessDegraded: input.livenessDegraded ?? false,
    severity,
    invariants: input.invariants,
    detections: input.detections,
    recovery: input.recovery,
    notes: input.notes,
    passed: passed && severity !== 'INVARIANT_BREACH',
  };
}

export function campaignSeverity(input: {
  readonly safetyHeld: boolean;
  readonly livenessDegraded: boolean;
}): CampaignSeverity {
  if (!input.safetyHeld) {
    return 'INVARIANT_BREACH';
  }
  if (input.livenessDegraded) {
    return 'DEGRADED_BUT_SAFE';
  }
  return 'PROTECTED';
}

export function holdAll(ids: readonly SecurityInvariantId[], detail: string): SecurityInvariantResult[] {
  return ids.map((id) => held(id, detail));
}

export function caught(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
