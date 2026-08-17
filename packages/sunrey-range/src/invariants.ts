import { SECURITY_INVARIANT_IDS, type SecurityInvariantId, type SecurityInvariantResult } from './types.ts';

export type { SecurityInvariantId };

export const INVARIANT_CATALOG: Readonly<
  Record<SecurityInvariantId, { readonly title: string; readonly owner: string; readonly statement: string }>
> = Object.freeze({
  NO_CONFLICTING_FINALITY: {
    title: 'No conflicting finality',
    owner: 'packages/sunrey-chain',
    statement: 'A height may finalize at most one block identifier under the same validator set.',
  },
  NO_UNAUTHORIZED_ISSUANCE: {
    title: 'No unauthorized issuance',
    owner: 'packages/sunrey-chain',
    statement: 'MoonRey and native assets may issue only through authorized engines with Execution-Authority-gated mutators where required.',
  },
  NO_ASSET_CREATION_FROM_SETTLEMENT: {
    title: 'No asset creation from settlement',
    owner: 'packages/sunrey-exchange',
    statement: 'Settlement and DVP move existing reserved units. They do not mint new economic units.',
  },
  NO_DOUBLE_SETTLEMENT: {
    title: 'No double settlement',
    owner: 'packages/sunrey-exchange',
    statement: 'A trade or settlement authorization may finalize at most once. Replays are refused.',
  },
  NO_DOUBLE_MOONREY_ATTRIBUTION: {
    title: 'No double MoonRey attribution',
    owner: 'packages/sunrey-chain',
    statement: 'A productive contribution fingerprint may authorize issuance at most once.',
  },
  NO_UNAUTHORIZED_GOVERNANCE: {
    title: 'No unauthorized governance',
    owner: 'packages/sunrey-chain',
    statement: 'Protocol, fee, CryptoSuite, and asset-policy changes require a governed, signed proposal.',
  },
  NO_VALIDATOR_KEY_REUSE: {
    title: 'No validator key reuse',
    owner: 'packages/sunrey-chain',
    statement: 'A consensus key may be live in at most one fenced signer location. Conflicting signatures are evidence.',
  },
  NO_RAW_PERSONAL_DATA_EGRESS: {
    title: 'No raw personal-data egress',
    owner: 'packages/sunrey-explorer',
    statement: 'Explorer, telemetry, and information-right exports must not emit raw PDV, KYC, or private consent rows.',
  },
  NO_INTEROP_PROOF_BYPASS: {
    title: 'No interop proof bypass',
    owner: 'packages/sunrey-chain',
    statement: 'Headers, finality, and membership proofs are verified. Relayers are untrusted.',
  },
  NO_BLIND_WITHDRAWAL_RESUBMISSION: {
    title: 'No blind withdrawal resubmission',
    owner: 'packages/custody',
    statement: 'A timed-out or unknown custody submission cannot be blindly resigned against a new destination.',
  },
  NO_MACHINE_MANDATE_BYPASS: {
    title: 'No machine mandate bypass',
    owner: 'packages/sunrey-chain',
    statement: 'Machine spend, capability, and delivery actions beyond an explicit mandate are refused.',
  },
});

export function invariantIds(): readonly SecurityInvariantId[] {
  return SECURITY_INVARIANT_IDS;
}

export function held(invariantId: SecurityInvariantId, detail: string): SecurityInvariantResult {
  return { invariantId, held: true, detail };
}

export function violated(invariantId: SecurityInvariantId, detail: string): SecurityInvariantResult {
  return { invariantId, held: false, detail };
}

export function catalogComplete(): boolean {
  return SECURITY_INVARIANT_IDS.every((id) => INVARIANT_CATALOG[id] !== undefined);
}
