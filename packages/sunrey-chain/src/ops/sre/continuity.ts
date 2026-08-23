import { DEGRADED_MODE_IDS, type DegradedModeId } from './types.ts';

export type DegradedMode = {
  readonly id: DegradedModeId;
  readonly unavailable: string;
  readonly remainsAvailable: readonly string[];
  readonly paused: readonly string[];
  readonly moneyUiUsable: boolean;
  readonly inventSubstituteProvider: false;
};

const MODES: readonly DegradedMode[] = Object.freeze([
  {
    id: 'AGENT_UNAVAILABLE',
    unavailable: 'SunRey Agent / model / tool path',
    remainsAvailable: Object.freeze(['Money UI', 'accounts', 'payments', 'balances']),
    paused: Object.freeze(['agent proposals', 'automated conversational actions']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'EXCHANGE_UNAVAILABLE',
    unavailable: 'Exchange matching and settlement',
    remainsAvailable: Object.freeze(['banking', 'payments', 'balances', 'identity']),
    paused: Object.freeze(['order entry', 'matching', 'exchange withdrawals that require settlement']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'FX_PROVIDER_UNAVAILABLE',
    unavailable: 'FX quote provider',
    remainsAvailable: Object.freeze(['same-currency transfers', 'balances', 'Money UI']),
    paused: Object.freeze(['cross-currency quotes', 'cross-currency settlement']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'CUSTODY_UNAVAILABLE',
    unavailable: 'Custody / HSM / withdrawal rail',
    remainsAvailable: Object.freeze(['read-only balances', 'Money UI reads', 'deposit observation when independently confirmed']),
    paused: Object.freeze(['withdrawals', 'custody signing']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'MODEL_OUTAGE',
    unavailable: 'AI inference runtime',
    remainsAvailable: Object.freeze(['Money UI', 'human-submitted intents', 'ProposalGate refusals as first-class outcomes']),
    paused: Object.freeze(['model completions', 'tool-driven proposals']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'CHAIN_STALL',
    unavailable: 'Chain finality',
    remainsAvailable: Object.freeze(['application ledger banking', 'payments that do not require native finality']),
    paused: Object.freeze(['native asset movement', 'wallet operations waiting on height']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'PROVIDER_UNAVAILABLE',
    unavailable: 'A required payment or compliance provider',
    remainsAvailable: Object.freeze(['paths that do not require that provider', 'control-room health', 'Kernel refuse/defer']),
    paused: Object.freeze(['actions that require the unavailable provider']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
  {
    id: 'KYC_PROVIDER_UNAVAILABLE',
    unavailable: 'KYC / sanctions / AML provider-candidate',
    remainsAvailable: Object.freeze(['existing authenticated sessions', 'read-only balances']),
    paused: Object.freeze(['new onboarding that requires KYC', 'actions the Kernel refuses without compliance facts']),
    moneyUiUsable: true,
    inventSubstituteProvider: false,
  },
]);

export function degradedModes(): readonly DegradedMode[] {
  return MODES;
}

export function degradedMode(id: DegradedModeId): DegradedMode {
  const found = MODES.find((row) => row.id === id);
  if (!found) {
    throw new Error(`unknown degraded mode ${id}`);
  }
  return found;
}

export function degradedModeCatalogComplete(): boolean {
  return MODES.length === DEGRADED_MODE_IDS.length && MODES.every((row) => row.moneyUiUsable || row.id === 'KYC_PROVIDER_UNAVAILABLE');
}
