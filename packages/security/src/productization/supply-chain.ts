/**
 * Supply-chain inventory. Does not claim SLSA provenance is complete
 * for every artifact. Records what exists and what remains external.
 */

export const SUPPLY_CHAIN_CONTROLS = Object.freeze({
  sbom: {
    present: true,
    command: 'npm run testnet:sbom',
    owner: 'scripts/sunrey-testnet-sbom.mjs',
  },
  dependencyAudit: {
    present: true,
    command: 'npm audit --omit=dev',
  },
  licenseInventory: {
    present: true,
    notes: 'package-lock.json + workspace package.json files',
  },
  provenance: {
    present: true,
    notes: 'Chunk 59 / release-candidate artifact signing; GitHub Actions SHA-pinned',
  },
  artifactSigning: {
    present: true,
    purpose: 'RELEASE_SIGNING',
    productionCeremonyComplete: false,
  },
  reproducibleBuild: {
    claimed: false,
    notes: 'lockfiles and --locked Rust builds; full bit-for-bit reproducibility is not claimed',
  },
  pinnedGitHubActions: {
    present: true,
    example: 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
  },
  containerDigestPinning: {
    requiredForRelease: true,
    pinsFile: 'packages/sunrey-chain/supply-chain/image-pins.json',
    digestsPopulated: false,
  },
});
