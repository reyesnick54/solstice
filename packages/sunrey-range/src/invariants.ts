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
  LEDGER_APPEND_ONLY: {
    title: 'Ledger append-only',
    owner: 'packages/ledger',
    statement: 'Journals are append-only. Corrections are new compensating entries. Event handlers cannot post journals.',
  },
  EXECUTION_AUTHORITY_REQUIRED: {
    title: 'Execution Authority required',
    owner: 'packages/permissions',
    statement: 'Consequential financial mutation requires a verified Execution Authority. Credentials, AI output, and control-room actions are not authority.',
  },
  KERNEL_CANNOT_BE_BYPASSED: {
    title: 'Kernel cannot be bypassed',
    owner: 'packages/kernel',
    statement: 'Provider results, AI proposals, and telemetry cannot inject a Kernel ALLOW or skip Compliance Kernel evaluation.',
  },
  ASSET_SUPPLYBOOK_CANONICAL: {
    title: 'AssetSupplyBook remains canonical',
    owner: 'packages/sunrey-chain',
    statement: 'Provider balances, fixtures, and operational snapshots cannot mutate AssetSupplyBook. Supply equations stay consistent.',
  },
  CHUNK_71_MONETARY_AUTHORITY: {
    title: 'Chunk 71 remains monetary authority',
    owner: 'packages/sunrey-chain',
    statement: 'SunRey and MoonRey issuance may occur only through the Chunk 71 monetary constitution. Production-candidate packages cannot mint.',
  },
  AI_CANNOT_EXECUTE: {
    title: 'AI cannot execute',
    owner: 'packages/ai-runtime',
    statement: 'Simulated S3M/Grok output remains proposals or text. AI cannot approve payments, sign withdrawals, issue Execution Authority, or override the Kernel.',
  },
  RAW_SECRET_NOT_EXPOSED: {
    title: 'Raw secret not exposed',
    owner: 'packages/security',
    statement: 'Credential plane, telemetry, logs, and range evidence must not emit raw secrets, Authorization headers, or secret paths.',
  },
  PII_NOT_PUBLIC_CHAIN: {
    title: 'PII not on a public chain',
    owner: 'packages/custody',
    statement: 'Travel Rule and explorer surfaces must not place raw originator/beneficiary PII on a public chain.',
  },
  ORACLE_CONSENSUS_NO_HTTP: {
    title: 'Oracle consensus does not call HTTP',
    owner: 'packages/sunrey-chain',
    statement: 'Oracle consensus engines consume fixture observations. Connector HTTP is off-consensus and fails closed.',
  },
  REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT: {
    title: 'Reference price is not productive output',
    owner: 'packages/sunrey-chain',
    statement: 'A reference-price observation cannot become a productive claim or mint authorization.',
  },
  CROSS_ASSET_CUSTODY_ISOLATED: {
    title: 'Cross-asset custody isolated',
    owner: 'packages/custody',
    statement: 'A MoonRey hold cannot be debited as SunRey and a SunRey hold cannot be debited as MoonRey.',
  },
  UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED: {
    title: 'Unknown submission is not blindly retried',
    owner: 'packages/payments',
    statement: 'SUBMISSION_UNKNOWN and lost provider responses require query/reconcile. Blind resubmit is refused.',
  },
  COMPLIANCE_UNAVAILABLE_NOT_CLEAR: {
    title: 'Compliance unavailable is not CLEAR',
    owner: 'packages/kernel',
    statement: 'KYC, sanctions, PEP, and AML unavailability or timeout fail closed. FAIL_OPEN_COMPLIANCE is false.',
  },
  CONTROL_ROOM_READ_ONLY: {
    title: 'Control room is read-only',
    owner: 'packages/sunrey-chain',
    statement: 'Control-room incident actions cannot post journals, mint, disable compliance, rotate funds, approve custody, or flip LIVE flags.',
  },
  PRODUCTION_NOT_ACTIVE: {
    title: 'Production is not active',
    owner: 'packages/config',
    statement: 'ENVIRONMENT stays simulation. Every LIVE_* flag stays false. Fixture parameters cannot authorize production.',
  },
  NO_RAW_SECRET_EXPOSURE: {
    title: 'No raw secret exposure',
    owner: 'packages/security',
    statement: 'Range evidence, logs, and credential handles never reveal raw secrets.',
  },
  NO_CROSS_WORKLOAD_CREDENTIAL_USE: {
    title: 'No cross-workload credential use',
    owner: 'packages/security',
    statement: 'A credential bound to one workload or provider domain cannot authorize another.',
  },
  CONNECTOR_FAILS_CLOSED: {
    title: 'Connector fails closed',
    owner: 'packages/sunrey-chain',
    statement: 'Fixture transports refuse localhost, metadata, link-local, credential-in-URL, redirect escape, and unapproved destinations. No external request is made.',
  },
  TRAVEL_RULE_ACK_IS_NOT_WITHDRAWAL_AUTHORITY: {
    title: 'Travel Rule acknowledgement is not withdrawal authority',
    owner: 'packages/custody',
    statement: 'A Travel Rule message acknowledgement cannot authorize a withdrawal or ledger posting.',
  },
  PRIVATE_KEY_EXPORT_FORBIDDEN: {
    title: 'Private key export forbidden',
    owner: 'packages/custody',
    statement: 'HSM/KMS handles are non-exportable. Private-key export attempts fail.',
  },
  NO_FALSE_INDEPENDENT_QUORUM: {
    title: 'No false independent quorum',
    owner: 'packages/sunrey-chain',
    statement: 'Two feeds with the same controller or upstream do not count as independent quorum members.',
  },
  NO_DIRECT_PROVIDER_MINT: {
    title: 'No direct provider mint',
    owner: 'packages/sunrey-chain',
    statement: 'An oracle or economic-data provider observation cannot mint SunRey or MoonRey.',
  },
  NO_REFERENCE_PRICE_MINT: {
    title: 'No reference-price mint',
    owner: 'packages/sunrey-chain',
    statement: 'Reference prices cannot convert into issuance quantities.',
  },
  NO_DUPLICATE_FINANCIAL_CONSEQUENCE: {
    title: 'No duplicate financial consequence',
    owner: 'packages/events',
    statement: 'Duplicate, replayed, or out-of-order events cannot create a second financial effect.',
  },
  NO_HUMAN_WORTH_SCORING: {
    title: 'No human-worth scoring',
    owner: 'packages/human-economic-contribution',
    statement: 'The SunRey human economic model refuses human-worth, PEVE-as-token, and protected-trait ranking fields.',
  },
  NO_REGULATORY_BYPASS: {
    title: 'No regulatory bypass',
    owner: 'packages/payments',
    statement: 'A provider claiming corridor support cannot override Kernel or SunRey policy that disables the corridor.',
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
