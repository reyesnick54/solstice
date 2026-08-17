import type { CoverageEntry } from './types.ts';

export const COVERAGE_INVENTORY: readonly CoverageEntry[] = Object.freeze([
  { subsystem: 'protocol', target: 'EnvelopeV1 decode', status: 'IMPLEMENTED', notes: 'TS decode() + Rust Unsigned/SignedTransaction' },
  { subsystem: 'protocol', target: 'transaction canonical encoding', status: 'IMPLEMENTED', notes: 'encode/decode + one-byte mutation' },
  { subsystem: 'protocol', target: 'protobuf unknown fields', status: 'IMPLEMENTED', notes: 'injectUnknownField rejected' },
  { subsystem: 'protocol', target: 'schema-version handling', status: 'IMPLEMENTED', notes: 'invalid version rejected' },
  { subsystem: 'protocol', target: 'authentication / signatures', status: 'IMPLEMENTED', notes: 'malleability + downgrade fixtures' },
  { subsystem: 'protocol', target: 'addresses / account descriptors', status: 'IMPLEMENTED', notes: 'TS encode/parse; Rust parse fuzz' },
  { subsystem: 'protocol', target: 'native asset / fee / governance / oracle / productive / machine / interop payloads', status: 'IMPLEMENTED', notes: 'envelope family decode + corpus' },
  { subsystem: 'block', target: 'BlockHeader / roots / certificates', status: 'IMPLEMENTED', notes: 'Rust BlockHeader::decode + consensus cert fuzz' },
  { subsystem: 'consensus', target: 'Proposal/Prevote/Precommit/CommitCertificate/VoteSet/WAL', status: 'IMPLEMENTED', notes: 'existing cargo-fuzz + new campaign' },
  { subsystem: 'consensus', target: 'state-machine safety', status: 'IMPLEMENTED', notes: 'TS model + Rust FourValidatorHarness campaign' },
  { subsystem: 'consensus', target: 'signer safety', status: 'IMPLEMENTED', notes: 'DurableSignerSafety sequences + Rust SignerSafetyStore' },
  { subsystem: 'assets', target: 'SUNREY_COIN / MOONREY_COIN supply', status: 'IMPLEMENTED', notes: 'TS invariant book + Rust NativeAssetLedger proptest' },
  { subsystem: 'fees', target: 'actual/max/reserve/disposition', status: 'IMPLEMENTED', notes: 'TS FeeEngine + Rust FeeSchedule::calculate' },
  { subsystem: 'wallet', target: 'M-of-N / revoke / historic / watch-only', status: 'IMPLEMENTED', notes: 'authorizeAccountAction + Rust authorize' },
  { subsystem: 'oracle', target: 'quorum / order / stale / units', status: 'IMPLEMENTED', notes: 'median order-independence + Rust integer_median' },
  { subsystem: 'moonrey', target: 'issuance / fingerprint / caps / supply', status: 'IMPLEMENTED', notes: 'formula + fingerprint + supplyReconciles' },
  { subsystem: 'machine', target: 'capability / mandate / escrow / revoke', status: 'IMPLEMENTED', notes: 'MachineEconomyEngine refuseAuthority' },
  { subsystem: 'exchange', target: 'DVP / reservation / universal markets', status: 'IMPLEMENTED', notes: 'tests/assurance exchange properties' },
  { subsystem: 'interop', target: 'proofs / packets / replay / freeze', status: 'IMPLEMENTED', notes: 'InteropEngine packet-at-most-once' },
  { subsystem: 'differential', target: 'TS/Rust fees, mulDiv, formula, fingerprint, median', status: 'IMPLEMENTED', notes: 'shared JSON cases' },
  { subsystem: 'differential', target: 'address bytes', status: 'PARTIAL', notes: 'round-trip tested per language; payload class encoding differs by language' },
  { subsystem: 'replay', target: 'sunrey-test replay', status: 'IMPLEMENTED', notes: 'TS CLI + Rust bin' },
  { subsystem: 'formal-verification', target: 'machine-checked proofs', status: 'NOT_APPLICABLE', notes: 'Chunk 56 is fuzz/property assurance, not formal verification' },
]);

export function coverageCounts(): { readonly implemented: number; readonly partial: number; readonly notApplicable: number } {
  return {
    implemented: COVERAGE_INVENTORY.filter((entry) => entry.status === 'IMPLEMENTED').length,
    partial: COVERAGE_INVENTORY.filter((entry) => entry.status === 'PARTIAL').length,
    notApplicable: COVERAGE_INVENTORY.filter((entry) => entry.status === 'NOT_APPLICABLE').length,
  };
}
