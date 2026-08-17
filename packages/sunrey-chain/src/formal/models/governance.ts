import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type GovernanceStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'SCHEDULED'
  | 'ACTIVATED'
  | 'REJECTED';

export type GovernanceState = {
  readonly contentHash: string;
  readonly status: GovernanceStatus;
  readonly votes: Readonly<Record<string, 'APPROVE' | 'REJECT'>>;
  readonly authorizedPower: number;
  readonly activationHeight: number;
  readonly height: number;
  readonly actor: 'HUMAN' | 'AI';
  readonly binaryInstalled: boolean;
  readonly rulesVersion: number;
};

const POWER: Readonly<Record<string, number>> = { V1: 1, V2: 1, V3: 1 };

export function createGovernanceModel(bounds: FormalModelBounds): FormalModel<GovernanceState> {
  const maxHeight = bounds.maxHeight ?? 3;
  return {
    modelId: 'PROTOCOL_GOVERNANCE',
    modelVersion: '1.0.0',
    bounds: { maxHeight, validators: 3 },
    init: () => ({
      contentHash: 'plan_v1',
      status: 'DRAFT',
      votes: {},
      authorizedPower: 0,
      activationHeight: 2,
      height: 0,
      actor: 'HUMAN',
      binaryInstalled: false,
      rulesVersion: 1,
    }),
    next: (state) => {
      const out: Transition<GovernanceState>[] = [];
      if (state.status === 'DRAFT') {
        out.push({ name: 'Propose', next: { ...state, status: 'PROPOSED' } });
      }
      if (state.status === 'PROPOSED') {
        for (const voter of Object.keys(POWER)) {
          if (state.votes[voter]) {
            out.push({ name: `DuplicateVote(${voter})`, next: null });
            continue;
          }
          out.push({
            name: `Vote(${voter},APPROVE)`,
            next: { ...state, votes: { ...state.votes, [voter]: 'APPROVE' } },
          });
        }
        const power = Object.entries(state.votes)
          .filter(([, choice]) => choice === 'APPROVE')
          .reduce((sum, [id]) => sum + (POWER[id] ?? 0), 0);
        if (power >= 3) {
          out.push({
            name: 'Authorize',
            next: { ...state, status: 'AUTHORIZED', authorizedPower: power },
          });
        } else {
          out.push({ name: 'RefuseInsufficientPower', next: null });
        }
      }
      if (state.status === 'AUTHORIZED') {
        out.push({ name: 'MutateContent', next: null });
        out.push({ name: 'Schedule', next: { ...state, status: 'SCHEDULED' } });
      }
      if (state.status === 'SCHEDULED') {
        if (state.height < state.activationHeight) {
          out.push({ name: 'RefuseEarlyActivate', next: null });
        }
        if (state.actor === 'AI') {
          out.push({ name: 'RefuseAiActivate', next: null });
        }
        if (state.height >= state.activationHeight && state.actor === 'HUMAN') {
          out.push({
            name: 'Activate',
            next: { ...state, status: 'ACTIVATED', rulesVersion: state.rulesVersion + 1 },
          });
        }
      }
      if (state.binaryInstalled === false) {
        out.push({
          name: 'InstallBinary',
          next: { ...state, binaryInstalled: true },
        });
      }
      if (state.height < maxHeight) {
        out.push({ name: 'AdvanceHeight', next: { ...state, height: state.height + 1 } });
      }
      if (state.actor === 'HUMAN' && state.status !== 'ACTIVATED') {
        out.push({ name: 'AiPreparer', next: { ...state, actor: 'AI' } });
      }
      return out;
    },
    key: (state) =>
      `${state.status}|${state.contentHash}|${JSON.stringify(state.votes)}|${state.height}|${state.actor}|${state.binaryInstalled}|${state.rulesVersion}`,
    invariants: {
      CONTENT_IMMUTABLE_AFTER_AUTHORIZATION: (state) =>
        state.status === 'DRAFT' || state.status === 'PROPOSED' || state.contentHash === 'plan_v1',
      VOTES_COUNTED_ONCE: (state) =>
        Object.keys(state.votes).length === new Set(Object.keys(state.votes)).size,
      INSUFFICIENT_POWER_CANNOT_AUTHORIZE: (state) =>
        state.status !== 'AUTHORIZED' && state.status !== 'SCHEDULED' && state.status !== 'ACTIVATED'
          ? true
          : state.authorizedPower >= 3,
      ACTIVATION_NOT_BEFORE_HEIGHT: (state) =>
        state.status !== 'ACTIVATED' || state.height >= state.activationHeight,
      AI_CANNOT_AUTHORIZE: (state) => state.actor !== 'AI' || state.status !== 'ACTIVATED',
      BINARY_INSTALL_DOES_NOT_CHANGE_RULES: (state) =>
        !state.binaryInstalled || state.status === 'ACTIVATED' || state.rulesVersion === 1,
    },
  };
}
