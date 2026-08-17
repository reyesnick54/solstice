import { TRUST_BOUNDARY_IDS, type TrustBoundary } from './types.ts';

export const TRUST_BOUNDARIES: readonly TrustBoundary[] = Object.freeze([
  {
    id: 'validator',
    description: 'Validator process holding consensus and proposal material, WAL, and local state.',
    mayContainSecrets: true,
    secretClasses: ['validator consensus keys', 'block proposal keys', 'WAL signer state'],
    ownerPath: 'packages/sunrey-chain/src/ops',
  },
  {
    id: 'remote_signer',
    description: 'Separated signing process. Consensus votes leave the validator host unsigned.',
    mayContainSecrets: true,
    secretClasses: ['validator consensus keys', 'block proposal keys'],
    ownerPath: 'packages/sunrey-chain/src/ops/signer.ts',
  },
  {
    id: 'sentry',
    description: 'Public-facing peer proxy. Must not hold validator private keys.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-chain/src/ops/sentry.ts',
  },
  {
    id: 'public_rpc',
    description: 'Public query and transaction submission. Must not hold validator or custody keys.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-chain/rust/crates/rpc',
  },
  {
    id: 'sdk',
    description: 'Official developer adapter. Holds only caller-supplied session material.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-sdk',
  },
  {
    id: 'wallet_signer',
    description: 'Local wallet signer / development keystore.',
    mayContainSecrets: true,
    secretClasses: ['wallet keys', 'recovery material'],
    ownerPath: 'packages/sunrey-chain/src/wallet',
  },
  {
    id: 'custody_hsm',
    description: 'Institutional custody signing boundary. Production HSM is not completed; development simulator only.',
    mayContainSecrets: true,
    secretClasses: ['custody signing keys', 'HSM credentials'],
    ownerPath: 'packages/custody/src/institutional',
  },
  {
    id: 'exchange',
    description: 'Matching, reservation, and DVP orchestration. Holds reservation state, not chain keys.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-exchange',
  },
  {
    id: 'oracle_provider',
    description: 'Oracle observation signer. Provider keys stay off the chain process.',
    mayContainSecrets: true,
    secretClasses: ['oracle provider keys'],
    ownerPath: 'packages/sunrey-chain/src/oracle',
  },
  {
    id: 'relayer',
    description: 'Interop packet relayer. Must not hold governance or validator keys.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-chain/src/interop',
  },
  {
    id: 'explorer',
    description: 'Public projection. Default field class is FORBIDDEN. No raw PDV or KYC.',
    mayContainSecrets: false,
    secretClasses: [],
    ownerPath: 'packages/sunrey-explorer',
  },
  {
    id: 'personal_data_vault',
    description: 'Subject-bound encrypted store. Raw payloads stay inside the vault.',
    mayContainSecrets: true,
    secretClasses: ['private personal data', 'vault keys'],
    ownerPath: 'packages/personal-data-vault',
  },
  {
    id: 'clean_room',
    description: 'Consent-gated constrained computation. Raw rows default DENY.',
    mayContainSecrets: true,
    secretClasses: ['join tokens', 'constrained working set'],
    ownerPath: 'packages/clean-room',
  },
  {
    id: 'governance_authority',
    description: 'Protocol UpgradePlan authority. Not a software-release signer.',
    mayContainSecrets: true,
    secretClasses: ['governance keys'],
    ownerPath: 'packages/sunrey-chain/src/governance',
  },
  {
    id: 'release_authority',
    description: 'Chunk 59 software ReleaseAuthority. Signs artifacts only. Does not change chain state.',
    mayContainSecrets: true,
    secretClasses: ['release keys'],
    ownerPath: 'packages/sunrey-chain/src/supply-chain',
  },
]);

export function trustBoundaryIds(): readonly string[] {
  return TRUST_BOUNDARY_IDS;
}

export function secretBearingBoundaries(
  rows: readonly TrustBoundary[] = TRUST_BOUNDARIES,
): readonly TrustBoundary[] {
  return rows.filter((row) => row.mayContainSecrets);
}
