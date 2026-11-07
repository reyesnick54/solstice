import type { HELIOS_EXEC13_SCHEMA } from './taxonomy.ts';
import type {
  Exec13ChaosScenarioId,
  Exec13DependencyPlane,
  Exec13KillSwitchMode,
  Exec13KillSwitchScope,
  Exec13OrderAction,
  Exec13ResilienceState,
} from './taxonomy.ts';

export type Exec13KillSwitchActor = 'HUMAN_OPERATOR' | 'SYSTEM' | 'AGENT';

export type Exec13KillSwitchRecord = {
  readonly killSwitchId: string;
  readonly scope: Exec13KillSwitchScope;
  readonly target: string;
  readonly mode: Exec13KillSwitchMode;
  readonly enabled: boolean;
  readonly reason: string;
  readonly actorKind: Exclude<Exec13KillSwitchActor, 'AGENT'>;
  readonly activatedAt: string;
  readonly activationSequence: number;
  readonly auditDigest: string;
};

export type Exec13KillSwitchTarget = {
  readonly global?: boolean;
  readonly providerId?: string;
  readonly accountId?: string;
  readonly strategyId?: string;
  readonly instrumentId?: string;
  readonly marketId?: string;
  readonly customerId?: string;
};

export type Exec13ResilienceContext = {
  readonly connectivityState: Exec13ResilienceState;
  readonly killSwitchReasons: readonly string[];
  readonly dependencyUnavailable: readonly Exec13DependencyPlane[];
};

export type Exec13OrderGateResult =
  | { readonly ok: true; readonly action: Exec13OrderAction }
  | { readonly ok: false; readonly code: string; readonly state: Exec13ResilienceState };

export type Exec13ChaosExpectation = {
  readonly scenarioId: Exec13ChaosScenarioId;
  readonly expectFailSafe: boolean;
  readonly expectNoBlindResubmit: boolean;
  readonly expectDuplicateSuppression: boolean;
  readonly expectReconciliationPath: boolean;
  readonly minimumResultingState: Exec13ResilienceState | null;
};

export type Exec13ChaosScenarioResult = {
  readonly scenarioId: Exec13ChaosScenarioId;
  readonly passed: boolean;
  readonly resultingState: Exec13ResilienceState;
  readonly blindResubmitBlocked: boolean;
  readonly duplicateSubmitPrevented: boolean;
  readonly evidenceSealed: boolean;
  readonly notes: readonly string[];
};

export type Exec13QualificationReport = {
  readonly schema: typeof HELIOS_EXEC13_SCHEMA;
  readonly scenarios: readonly Exec13ChaosScenarioResult[];
  readonly killSwitchAuditDeterministic: boolean;
  readonly agentCannotDisableKillSwitch: boolean;
  readonly brokerFailoverNoBlindResubmit: boolean;
  readonly allScenariosPassed: boolean;
};

export type BrokerAcceptanceProbe =
  | { readonly known: true; readonly accepted: boolean; readonly brokerOrderId: string | null }
  | { readonly known: false; readonly reason: string };

export type BrokerFailoverPlan =
  | {
      readonly ok: true;
      readonly abandonedBrokerId: string;
      readonly successorBrokerId: string;
      readonly requiresNewLineage: true;
      readonly priorState: 'RECONCILIATION_REQUIRED';
    }
  | { readonly ok: false; readonly code: string; readonly message: string };
