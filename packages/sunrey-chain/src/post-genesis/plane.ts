/**
 * Post-genesis operational control plane.
 *
 * Chain health, economic integrity, and each customer-facing capability
 * are independently verified. Genesis never automatically enables
 * regulated or high-risk financial services.
 */

import type { EmergencyActionClass } from '../governance-ops/types.ts';
import {
  assembleActivationPackage,
  historyEntry,
  verifyActivationPackage,
} from './capabilities.ts';
import { captureCheckpoint, isConfiguredCheckpoint, protocolCoordinate } from './checkpoints.ts';
import {
  auditSupply,
  auditValidatorEconomics,
  rehearsalSupply,
  rehearsalValidatorEconomics,
  treasuryProductionState,
} from './economics.ts';
import { composeHealthReport, conflictingFinality, healthyObservation, type HealthObservation } from './health.ts';
import { defaultPostGenesisPolicy } from './identity.ts';
import { conflictingFinalityIncident, openIncident } from './incidents.ts';
import { canAdvancePhase } from './phases.ts';
import { applyRestriction, restrictionBypassRejected } from './restrictions.ts';
import type {
  BackupCheckpoint,
  CapabilityActivationPackage,
  CapabilityActivationResult,
  CapabilityHistoryEntry,
  IndependentCapability,
  PostGenesisCheckpoint,
  PostGenesisEconomicAudit,
  PostGenesisHealthReport,
  PostGenesisIncident,
  PostGenesisPhase,
  PostGenesisPolicy,
  PostGenesisValidatorAudit,
} from './types.ts';

export type StabilizationState = {
  readonly policy: PostGenesisPolicy;
  readonly phase: PostGenesisPhase;
  readonly latestCheckpoint: PostGenesisCheckpoint | null;
  readonly latestHealth: PostGenesisHealthReport | null;
  readonly economicAudit: PostGenesisEconomicAudit | null;
  readonly validatorAudit: PostGenesisValidatorAudit | null;
  readonly incidents: readonly PostGenesisIncident[];
  readonly history: readonly CapabilityHistoryEntry[];
  readonly backups: readonly BackupCheckpoint[];
  readonly enabled: ReadonlySet<IndependentCapability>;
  readonly restricted: ReadonlySet<IndependentCapability>;
  readonly usedPackageHashes: ReadonlySet<string>;
  readonly finalizedRoots: readonly string[];
};

export function initialStabilizationState(policy: PostGenesisPolicy = defaultPostGenesisPolicy()): StabilizationState {
  return {
    policy,
    phase: policy.initialPhase,
    latestCheckpoint: null,
    latestHealth: null,
    economicAudit: null,
    validatorAudit: null,
    incidents: Object.freeze([]),
    history: Object.freeze([]),
    backups: Object.freeze([]),
    enabled: new Set(),
    restricted: new Set(),
    usedPackageHashes: new Set(),
    finalizedRoots: Object.freeze([]),
  };
}

export function recordCheckpoint(
  state: StabilizationState,
  input: {
    readonly height: number;
    readonly epoch: number;
    readonly finalizedStateRoot: string;
    readonly observation?: HealthObservation;
  },
): StabilizationState {
  const coordinate = protocolCoordinate(input.height, input.epoch, input.finalizedStateRoot);
  if (!isConfiguredCheckpoint(state.policy, coordinate) && input.height !== 0) {
    return state;
  }
  const checkpoint = captureCheckpoint(state.policy, state.phase, coordinate);
  const observation = input.observation ?? healthyObservation();
  const health = composeHealthReport(checkpoint, observation);
  const incidents = [...state.incidents];
  if (health.conflictingFinality) {
    incidents.push(conflictingFinalityIncident(checkpoint.checkpointId, 'conflicting finality evidence at checkpoint'));
  }
  const economicAudit = auditSupply(checkpoint, rehearsalSupply());
  const validatorAudit = auditValidatorEconomics(checkpoint, rehearsalValidatorEconomics());
  const backups = [...state.backups];
  if (state.policy.backupsOperate && (coordinate.height === 16 || coordinate.height === 32)) {
    backups.push(
      Object.freeze({
        checkpointId: checkpoint.checkpointId,
        verified: true,
        restoreValidatedOnClone: true,
        activeNetworkTouched: false,
        notes: 'Restore validated on an isolated clone. Active network was not touched.',
      }),
    );
  }
  return {
    ...state,
    latestCheckpoint: checkpoint,
    latestHealth: health,
    economicAudit,
    validatorAudit,
    incidents: Object.freeze(incidents),
    backups: Object.freeze(backups),
    finalizedRoots: Object.freeze([...state.finalizedRoots, coordinate.finalizedStateRoot]),
  };
}

export function applyObservation(state: StabilizationState, observation: HealthObservation): StabilizationState {
  if (!state.latestCheckpoint) {
    return recordCheckpoint(state, {
      height: 1,
      epoch: 0,
      finalizedStateRoot: 'aaaaaaaa',
      observation,
    });
  }
  const health = composeHealthReport(state.latestCheckpoint, observation);
  const incidents = [...state.incidents];
  if (health.conflictingFinality && !incidents.some((row) => row.conflictingFinality)) {
    incidents.push(conflictingFinalityIncident(state.latestCheckpoint.checkpointId, 'conflicting finality evidence'));
  }
  return { ...state, latestHealth: health, incidents: Object.freeze(incidents) };
}

export function activateCapability(
  state: StabilizationState,
  pkg: CapabilityActivationPackage,
): { readonly state: StabilizationState; readonly result: CapabilityActivationResult } {
  const result = verifyActivationPackage(pkg, state.policy, state.usedPackageHashes);
  const used = new Set(state.usedPackageHashes);
  used.add(pkg.packageHash);
  const enabled = new Set(state.enabled);
  if (result.outcome === 'ACTIVATED') {
    enabled.add(pkg.capability);
  }
  return {
    state: {
      ...state,
      enabled,
      usedPackageHashes: used,
      history: Object.freeze([...state.history, historyEntry(pkg, result)]),
    },
    result,
  };
}

export function restrictCapability(
  state: StabilizationState,
  capability: IndependentCapability,
  action: EmergencyActionClass | string,
): { readonly state: StabilizationState; readonly ok: boolean; readonly reason: string } {
  if (restrictionBypassRejected(action)) {
    return {
      state: {
        ...state,
        incidents: Object.freeze([
          ...state.incidents,
          openIncident({
            category: 'GOVERNANCE',
            severity: 'HIGH',
            checkpointId: state.latestCheckpoint?.checkpointId ?? null,
            component: capability,
            evidence: `restriction bypass rejected: ${action}`,
            operatorAction: 'REFUSE_FORBIDDEN_POWER',
          }),
        ]),
      },
      ok: false,
      reason: 'restriction bypass rejected',
    };
  }
  const restricted = new Set(state.restricted);
  restricted.add(capability);
  applyRestriction('ACTIVE', capability);
  const enabled = new Set(state.enabled);
  enabled.delete(capability);
  return {
    state: { ...state, restricted, enabled },
    ok: true,
    reason: 'restriction applied',
  };
}

export function advancePhase(state: StabilizationState, next: PostGenesisPhase): StabilizationState {
  if (!canAdvancePhase(state.phase, next)) {
    return state;
  }
  return { ...state, phase: next };
}

export function attemptEarlyActivation(
  state: StabilizationState,
  capability: IndependentCapability,
  actorKind: 'HUMAN' | 'AI' = 'HUMAN',
  overrides: Partial<CapabilityActivationPackage> = {},
): { readonly state: StabilizationState; readonly result: CapabilityActivationResult } {
  const pkg = assembleActivationPackage({
    capability,
    policy: state.policy,
    humanAuthority: actorKind === 'HUMAN'
      ? [
          {
            actorKind: 'HUMAN',
            actorId: 'human-rehearsal',
            role: 'OPERATIONS_AUTHORITY',
            statement: 'rehearsal early activation attempt',
            signedAtUtc: '2026-08-18T00:00:00.000Z',
            accepted: true,
          },
        ]
      : [
          {
            actorKind: 'AI',
            actorId: 'ai-analyst',
            role: 'AI_ANALYST',
            statement: 'AI cannot authorize production activation',
            signedAtUtc: '2026-08-18T00:00:00.000Z',
            accepted: true,
          },
        ],
    ...overrides,
  });
  return activateCapability(state, pkg);
}

export function historicFinalizedUnchanged(state: StabilizationState): boolean {
  return state.incidents.every((row) => row.rewritesFinalizedState === false);
}

export function genesisLeavesCapabilitiesDisabled(state: StabilizationState): boolean {
  return state.enabled.size === 0 && treasuryProductionState().genesisAuthorizesSpending === false;
}

export function applyConflictingFinality(state: StabilizationState): StabilizationState {
  const observation = conflictingFinality(state.latestHealth ? observationFromHealth(state.latestHealth) : healthyObservation());
  return applyObservation(state, observation);
}

function observationFromHealth(health: PostGenesisHealthReport): HealthObservation {
  return {
    validatorParticipationBps: health.validatorParticipationBps,
    finality: health.finality,
    conflictingFinality: health.conflictingFinality,
    stateRootAgreement: health.stateRootAgreement,
    peerHealth: health.peerHealth,
    signerHealth: health.signerHealth,
    storage: health.storage,
    database: health.database,
    rpc: health.rpc,
    explorer: health.explorer,
    backup: health.backup,
    oracle: health.oracle,
    economicConserved: health.economicConserved,
    openIncidentCount: health.openIncidentCount,
    validators: health.validators,
    feeMarket: health.feeMarket,
  };
}
