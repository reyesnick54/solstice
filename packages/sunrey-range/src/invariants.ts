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
  NO_DUPLICATE_VALIDATOR_REWARD: {
    title: 'No duplicate validator reward',
    owner: 'packages/sunrey-chain',
    statement: 'One participation entitlement cannot produce two reward payments.',
  },
  NO_DUPLICATE_VALIDATOR_PENALTY: {
    title: 'No duplicate validator penalty',
    owner: 'packages/sunrey-chain',
    statement: 'One canonical evidence id cannot execute the same protocol penalty twice.',
  },
  NO_CUSTOMER_ASSET_VALIDATOR_PENALTY: {
    title: 'No customer-asset validator penalty',
    owner: 'packages/sunrey-chain',
    statement: 'Validator economic penalties cannot debit customer wallets, custody, Exchange, fiat ledger, or unrelated machine escrow.',
  },
  UNBOND_DELAY_RESPECTED: {
    title: 'Unbond delay respected',
    owner: 'packages/sunrey-chain',
    statement: 'A validator cannot release a bond before the governed unbonding delay and accountability window elapse.',
  },
  NO_TREASURY_MINT: {
    title: 'No treasury mint',
    owner: 'packages/sunrey-chain',
    statement: 'Protocol treasury cannot mint SunRey or MoonRey to fund a budget.',
  },
  NO_TREASURY_DOUBLE_SPEND: {
    title: 'No treasury double spend',
    owner: 'packages/sunrey-chain',
    statement: 'The same reserved treasury quantity cannot be committed to two disbursements.',
  },
  NO_UNAUTHORIZED_TREASURY_SPEND: {
    title: 'No unauthorized treasury spend',
    owner: 'packages/sunrey-chain',
    statement: 'AI and unauthorized actors cannot approve budgets or authorize treasury transfers.',
  },
  NO_CUSTOMER_ASSET_TREASURY_CLAIM: {
    title: 'No customer-asset treasury claim',
    owner: 'packages/sunrey-chain',
    statement: 'Protocol treasury cannot claim customer wallets, custody, Exchange obligations, machine escrow, or fiat ledger balances.',
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
