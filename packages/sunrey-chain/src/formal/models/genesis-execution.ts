import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type GenesisExecutionStatus =
  | 'PLAN_CREATED'
  | 'PLAN_VERIFIED'
  | 'AUTHORIZATION_COMPLETE'
  | 'EXECUTION_PERMIT_ISSUED'
  | 'GENESIS_EXECUTED'
  | 'FIRST_BLOCK_FINALIZED'
  | 'INITIAL_CHAIN_VERIFIED';

export type GenesisExecutionAuthState = {
  readonly status: GenesisExecutionStatus;
  readonly planHash: string;
  readonly genesisHash: string;
  readonly approvals: number;
  readonly actor: 'HUMAN' | 'AI';
  readonly permitUsed: boolean;
  readonly fixture: boolean;
  readonly finalized: boolean;
  readonly rewritten: boolean;
};

export function createGenesisExecutionAuthorizationModel(
  bounds: FormalModelBounds,
): FormalModel<GenesisExecutionAuthState> {
  void bounds;
  return {
    modelId: 'GENESIS_EXECUTION_AUTHORIZATION',
    modelVersion: '1.0.0',
    bounds: { validators: 3, maxHeight: 2 },
    init: () => ({
      status: 'PLAN_CREATED',
      planHash: 'plan_v1',
      genesisHash: 'gen_v1',
      approvals: 0,
      actor: 'HUMAN',
      permitUsed: false,
      fixture: false,
      finalized: false,
      rewritten: false,
    }),
    next: (state) => {
      const out: Transition<GenesisExecutionAuthState>[] = [];
      if (state.status === 'PLAN_CREATED') {
        out.push({ name: 'VerifyPlan', next: { ...state, status: 'PLAN_VERIFIED' } });
        out.push({ name: 'RefuseWrongPlan', next: null });
      }
      if (state.status === 'PLAN_VERIFIED') {
        out.push({
          name: 'ApproveHuman',
          next: { ...state, approvals: Math.min(state.approvals + 1, 3) },
        });
        out.push({ name: 'RefuseAiApprove', next: null });
        if (state.approvals >= 2 && state.actor === 'HUMAN' && !state.fixture) {
          out.push({ name: 'CompleteAuthorization', next: { ...state, status: 'AUTHORIZATION_COMPLETE' } });
        } else {
          out.push({ name: 'RefuseInsufficientAuthority', next: null });
        }
        out.push({ name: 'RefuseFixture', next: null });
      }
      if (state.status === 'AUTHORIZATION_COMPLETE' && !state.permitUsed) {
        out.push({ name: 'IssuePermit', next: { ...state, status: 'EXECUTION_PERMIT_ISSUED' } });
      }
      if (state.status === 'EXECUTION_PERMIT_ISSUED') {
        if (state.permitUsed) {
          out.push({ name: 'RefusePermitReplay', next: null });
        }
        if (state.planHash !== 'plan_v1') {
          out.push({ name: 'RefuseWrongPlanExecute', next: null });
        }
        if (state.genesisHash !== 'gen_v1') {
          out.push({ name: 'RefuseWrongGenesis', next: null });
        }
        if (state.actor === 'AI') {
          out.push({ name: 'RefuseAiExecute', next: null });
        }
        if (state.fixture) {
          out.push({ name: 'RefuseFixtureExecute', next: null });
        }
        if (
          !state.permitUsed &&
          state.planHash === 'plan_v1' &&
          state.genesisHash === 'gen_v1' &&
          state.actor === 'HUMAN' &&
          !state.fixture
        ) {
          out.push({
            name: 'ExecuteGenesis',
            next: { ...state, status: 'GENESIS_EXECUTED', permitUsed: true },
          });
        }
      }
      if (state.status === 'GENESIS_EXECUTED') {
        out.push({
          name: 'FinalizeFirstBlock',
          next: { ...state, status: 'FIRST_BLOCK_FINALIZED', finalized: true },
        });
      }
      if (state.status === 'FIRST_BLOCK_FINALIZED') {
        out.push({ name: 'VerifyInitialChain', next: { ...state, status: 'INITIAL_CHAIN_VERIFIED' } });
        out.push({ name: 'RefuseHistoryRewrite', next: null });
      }
      if (
        state.actor === 'HUMAN' &&
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status)
      ) {
        out.push({ name: 'AiAnalyst', next: { ...state, actor: 'AI' } });
      }
      return out;
    },
    key: (state) =>
      `${state.status}|${state.planHash}|${state.genesisHash}|${state.approvals}|${state.actor}|${state.permitUsed}|${state.fixture}|${state.finalized}`,
    invariants: {
      WRONG_PLAN_CANNOT_EXECUTE: (state) =>
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status) ||
        state.planHash === 'plan_v1',
      WRONG_GENESIS_CANNOT_EXECUTE: (state) =>
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status) ||
        state.genesisHash === 'gen_v1',
      INSUFFICIENT_HUMAN_AUTHORITY_CANNOT_EXECUTE: (state) =>
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status) ||
        state.approvals >= 2,
      AI_CANNOT_AUTHORIZE: (state) =>
        state.actor !== 'AI' ||
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status),
      FIXTURE_ARTIFACTS_CANNOT_EXECUTE_PRODUCTION: (state) =>
        !['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED'].includes(state.status) ||
        state.fixture === false,
      EXECUTION_PERMIT_CANNOT_BE_REPLAYED: (state) =>
        !state.permitUsed ||
        ['GENESIS_EXECUTED', 'FIRST_BLOCK_FINALIZED', 'INITIAL_CHAIN_VERIFIED', 'EXECUTION_PERMIT_ISSUED'].includes(
          state.status,
        ),
      FIRST_FINALIZED_STATE_NOT_REWRITTEN: (state) => state.finalized === false || state.rewritten === false,
    },
  };
}
