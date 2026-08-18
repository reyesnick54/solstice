export type AgentMandateSafetyState = {
  readonly budget: number;
  readonly spent: number;
  readonly assetApproved: boolean;
  readonly marketApproved: boolean;
  readonly revoked: boolean;
  readonly humanApproved: boolean;
  readonly humanRequired: boolean;
  readonly aiTriedToSign: boolean;
  readonly expanded: boolean;
  readonly authorized: boolean;
};

export type FormalTransition = {
  readonly name: string;
  readonly next: AgentMandateSafetyState | null;
};

export const AGENT_MANDATE_SAFETY = 'AGENT_MANDATE_SAFETY' as const;

export function createAgentMandateSafetyModel(): {
  readonly modelId: typeof AGENT_MANDATE_SAFETY;
  readonly init: AgentMandateSafetyState;
  readonly next: (state: AgentMandateSafetyState) => readonly FormalTransition[];
  readonly invariants: Readonly<Record<string, (state: AgentMandateSafetyState) => boolean>>;
} {
  const init: AgentMandateSafetyState = {
    budget: 2,
    spent: 0,
    assetApproved: true,
    marketApproved: true,
    revoked: false,
    humanApproved: false,
    humanRequired: true,
    aiTriedToSign: false,
    expanded: false,
    authorized: false,
  };
  return {
    modelId: AGENT_MANDATE_SAFETY,
    init,
    next: (state) => {
      const out: FormalTransition[] = [];
      out.push({ name: 'ExpandMandate', next: null });
      out.push({ name: 'ExceedBudget', next: null });
      out.push({ name: 'UseUnapprovedAsset', next: null });
      out.push({ name: 'UseUnapprovedMarket', next: null });
      out.push({ name: 'UseRevokedMandate', next: null });
      out.push({ name: 'AiIdentitySign', next: null });
      out.push({ name: 'ExecuteWithoutHuman', next: null });
      if (!state.revoked && state.assetApproved && state.marketApproved && state.spent < state.budget) {
        if (!state.humanRequired || state.humanApproved) {
          out.push({
            name: 'AuthorizeWithinMandate',
            next: { ...state, spent: state.spent + 1, authorized: true, aiTriedToSign: false, expanded: false },
          });
        }
        out.push({
          name: 'HumanApprove',
          next: { ...state, humanApproved: true },
        });
      }
      if (!state.revoked) {
        out.push({
          name: 'Revoke',
          next: { ...state, revoked: true, authorized: false },
        });
      }
      return out;
    },
    invariants: {
      AGENT_CANNOT_EXPAND_MANDATE: (state) => state.expanded === false,
      AGENT_CANNOT_EXCEED_BUDGET: (state) => state.spent <= state.budget,
      AGENT_CANNOT_USE_UNAPPROVED_ASSET: (state) => state.authorized === false || state.assetApproved,
      AGENT_CANNOT_USE_UNAPPROVED_MARKET: (state) => state.authorized === false || state.marketApproved,
      REVOKED_MANDATE_CANNOT_AUTHORIZE: (state) => !(state.revoked && state.authorized),
      AI_IDENTITY_ALONE_CANNOT_SIGN: (state) => state.aiTriedToSign === false || state.authorized === false,
      HUMAN_REQUIRED_NEEDS_APPROVAL: (state) => !(state.humanRequired && state.authorized && !state.humanApproved),
    },
  };
}

export function exploreAgentMandateSafety(maxDepth = 6): {
  readonly modelId: typeof AGENT_MANDATE_SAFETY;
  readonly states: number;
  readonly verified: true;
} {
  const model = createAgentMandateSafetyModel();
  const seen = new Set<string>();
  const queue: Array<{ state: AgentMandateSafetyState; depth: number }> = [{ state: model.init, depth: 0 }];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      break;
    }
    const key = JSON.stringify(item.state);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    for (const [name, invariant] of Object.entries(model.invariants)) {
      if (!invariant(item.state)) {
        throw new Error(`AGENT_MANDATE_SAFETY counterexample on ${name}`);
      }
    }
    if (item.depth >= maxDepth) {
      continue;
    }
    for (const transition of model.next(item.state)) {
      if (transition.next) {
        queue.push({ state: transition.next, depth: item.depth + 1 });
      }
    }
  }
  return { modelId: AGENT_MANDATE_SAFETY, states: seen.size, verified: true };
}
