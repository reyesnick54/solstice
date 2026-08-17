import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type GovernanceOpsStatus = 'PACKAGED' | 'APPROVED' | 'SCHEDULED' | 'ACTIVATED' | 'REJECTED';

export type GovernanceOpsState = {
  readonly packageHash: string;
  readonly status: GovernanceOpsStatus;
  readonly approvals: number;
  readonly requiredApprovals: number;
  readonly height: number;
  readonly activationHeight: number;
  readonly actor: 'HUMAN' | 'AI';
  readonly emergencyMint: boolean;
  readonly emergencyScope: 'BOUNDED' | 'OVERREACH';
  readonly restriction: 'INACTIVE' | 'ACTIVE';
};

export function createGovernanceOpsModel(bounds: FormalModelBounds): FormalModel<GovernanceOpsState> {
  const maxHeight = Math.max(bounds.maxHeight ?? 3, 3);
  return {
    modelId: 'GOVERNANCE_OPERATION_SAFETY',
    modelVersion: '1.0.0',
    bounds: { maxHeight, validators: 3 },
    init: () => ({
      packageHash: 'pkg_v1',
      status: 'PACKAGED',
      approvals: 0,
      requiredApprovals: 2,
      height: 0,
      activationHeight: 2,
      actor: 'HUMAN',
      emergencyMint: false,
      emergencyScope: 'BOUNDED',
      restriction: 'INACTIVE',
    }),
    next: (state) => {
      const out: Transition<GovernanceOpsState>[] = [];
      if (state.status === 'PACKAGED') {
        out.push({ name: 'ApproveHuman', next: { ...state, approvals: Math.min(state.approvals + 1, 3) } });
        out.push({ name: 'RefuseAiApprove', next: null });
        if (state.approvals >= state.requiredApprovals) {
          out.push({ name: 'MarkApproved', next: { ...state, status: 'APPROVED' } });
        } else {
          out.push({ name: 'RefuseInsufficientApproval', next: null });
        }
        out.push({ name: 'TamperHash', next: null });
      }
      if (state.status === 'APPROVED') {
        out.push({ name: 'Schedule', next: { ...state, status: 'SCHEDULED' } });
      }
      if (state.status === 'SCHEDULED') {
        if (state.height < state.activationHeight) {
          out.push({ name: 'RefuseEarlyActivate', next: null });
        }
        if (state.actor === 'AI') {
          out.push({ name: 'RefuseAiActivate', next: null });
        }
        if (state.packageHash !== 'pkg_v1') {
          out.push({ name: 'RefuseWrongHash', next: null });
        }
        if (state.height >= state.activationHeight && state.actor === 'HUMAN' && state.packageHash === 'pkg_v1') {
          out.push({ name: 'Activate', next: { ...state, status: 'ACTIVATED' } });
        }
      }
      if (state.restriction === 'INACTIVE') {
        out.push({
          name: 'BoundedEmergency',
          next: { ...state, restriction: 'ACTIVE', emergencyScope: 'BOUNDED', emergencyMint: false },
        });
        out.push({ name: 'RefuseEmergencyMint', next: null });
        out.push({ name: 'RefuseEmergencyOverreach', next: null });
      }
      if (state.height < maxHeight) {
        out.push({ name: 'AdvanceHeight', next: { ...state, height: state.height + 1 } });
      }
      if (state.actor === 'HUMAN' && state.status !== 'ACTIVATED') {
        out.push({ name: 'AiAnalyst', next: { ...state, actor: 'AI' } });
      }
      return out;
    },
    key: (state) =>
      `${state.status}|${state.packageHash}|${state.approvals}|${state.height}|${state.actor}|${state.restriction}|${state.emergencyMint}`,
    invariants: {
      WRONG_PACKAGE_HASH_CANNOT_ACTIVATE: (state) =>
        state.status !== 'ACTIVATED' || state.packageHash === 'pkg_v1',
      INSUFFICIENT_APPROVAL_CANNOT_ACTIVATE: (state) =>
        state.status !== 'ACTIVATED' || state.approvals >= state.requiredApprovals,
      ACTIVATION_NOT_BEFORE_COORDINATE: (state) =>
        state.status !== 'ACTIVATED' || state.height >= state.activationHeight,
      AI_CANNOT_AUTHORIZE: (state) => state.actor !== 'AI' || state.status !== 'ACTIVATED',
      EMERGENCY_ACTION_CANNOT_MINT: (state) => state.emergencyMint === false,
      EMERGENCY_RESTRICTION_SCOPE_BOUNDED: (state) =>
        state.restriction !== 'ACTIVE' || state.emergencyScope === 'BOUNDED',
    },
  };
}
