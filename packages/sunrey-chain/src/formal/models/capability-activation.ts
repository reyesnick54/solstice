import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type CapabilityId = 'CHAIN' | 'EXCHANGE' | 'CUSTODY' | 'FIAT';

export type CapabilityActivationState = {
  readonly network: 'REHEARSAL' | 'WRONG';
  readonly capability: CapabilityId;
  readonly authority: 'HUMAN' | 'AI' | 'NONE';
  readonly evidence: 'PRESENT' | 'MISSING';
  readonly chainAuthorized: boolean;
  readonly exchangeEnabled: boolean;
  readonly custodyEnabled: boolean;
  readonly fiatEnabled: boolean;
  readonly restriction: 'INACTIVE' | 'ACTIVE';
  readonly finalizedUnchanged: true;
};

export function createCapabilityActivationModel(bounds: FormalModelBounds): FormalModel<CapabilityActivationState> {
  const maxHeight = Math.max(bounds.maxHeight ?? 2, 2);
  return {
    modelId: 'CAPABILITY_ACTIVATION_SAFETY',
    modelVersion: '1.0.0',
    bounds: { maxHeight, validators: 3 },
    init: () => ({
      network: 'REHEARSAL',
      capability: 'CHAIN',
      authority: 'NONE',
      evidence: 'MISSING',
      chainAuthorized: true,
      exchangeEnabled: false,
      custodyEnabled: false,
      fiatEnabled: false,
      restriction: 'INACTIVE',
      finalizedUnchanged: true,
    }),
    next: (state) => {
      const out: Transition<CapabilityActivationState>[] = [];
      out.push({ name: 'SelectExchange', next: { ...state, capability: 'EXCHANGE' } });
      out.push({ name: 'SelectCustody', next: { ...state, capability: 'CUSTODY' } });
      out.push({ name: 'SelectFiat', next: { ...state, capability: 'FIAT' } });
      out.push({ name: 'HumanAuthority', next: { ...state, authority: 'HUMAN' } });
      out.push({ name: 'AiAnalyst', next: { ...state, authority: 'AI' } });
      out.push({ name: 'PresentEvidence', next: { ...state, evidence: 'PRESENT' } });
      out.push({ name: 'WrongNetwork', next: { ...state, network: 'WRONG' } });
      out.push({
        name: 'Restrict',
        next: { ...state, restriction: 'ACTIVE', exchangeEnabled: false, custodyEnabled: false, fiatEnabled: false },
      });
      if (state.network !== 'REHEARSAL') {
        out.push({ name: 'RefuseWrongNetwork', next: null });
      }
      if (state.authority !== 'HUMAN') {
        out.push({ name: 'RefuseMissingAuthority', next: null });
      }
      if (state.authority === 'AI') {
        out.push({ name: 'RefuseAiActivate', next: null });
      }
      if (state.evidence !== 'PRESENT') {
        out.push({ name: 'RefuseMissingEvidence', next: null });
      }
      if (state.chainAuthorized && state.capability !== 'CHAIN') {
        out.push({ name: 'RefuseInheritChainAuthorization', next: null });
      }
      if (state.restriction === 'ACTIVE') {
        out.push({ name: 'RefuseRestrictionBypass', next: null });
      }
      out.push({ name: 'RefuseRewriteFinality', next: null });
      if (
        state.network === 'REHEARSAL' &&
        state.authority === 'HUMAN' &&
        state.evidence === 'PRESENT' &&
        state.restriction === 'INACTIVE' &&
        state.capability === 'CHAIN'
      ) {
        out.push({ name: 'MarkChainHealthy', next: { ...state, chainAuthorized: true } });
      }
      return out;
    },
    key: (state) =>
      `${state.network}|${state.capability}|${state.authority}|${state.evidence}|${state.exchangeEnabled}|${state.restriction}`,
    invariants: {
      CAPABILITIES_INDEPENDENT: (state) =>
        !(state.exchangeEnabled && !state.chainAuthorized) || state.evidence === 'PRESENT',
      WRONG_NETWORK_CANNOT_ACTIVATE: (state) =>
        state.network === 'REHEARSAL' || (!state.exchangeEnabled && !state.custodyEnabled && !state.fiatEnabled),
      MISSING_AUTHORITY_CANNOT_ACTIVATE: (state) =>
        state.authority === 'HUMAN' || (!state.exchangeEnabled && !state.custodyEnabled && !state.fiatEnabled),
      AI_CANNOT_ACTIVATE: (state) =>
        state.authority !== 'AI' || (!state.exchangeEnabled && !state.custodyEnabled && !state.fiatEnabled),
      REGULATED_DOES_NOT_INHERIT_CHAIN: (state) =>
        !state.exchangeEnabled && !state.custodyEnabled && !state.fiatEnabled,
      RESTRICTION_STATE_ENFORCED: (state) =>
        state.restriction !== 'ACTIVE' || (!state.exchangeEnabled && !state.custodyEnabled && !state.fiatEnabled),
      HISTORIC_FINALIZED_UNCHANGED: (state) => state.finalizedUnchanged === true,
    },
  };
}
