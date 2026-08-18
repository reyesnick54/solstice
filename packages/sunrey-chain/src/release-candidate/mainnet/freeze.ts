import { ENVIRONMENT } from '../../../../config/src/index.ts';
import { createProductionNetworkCandidateV2 } from '../../mainnet/candidate-v2/assemble.ts';
import { CANDIDATE_V2_DOMAIN, CANDIDATE_V2_ID } from '../../mainnet/candidate-v2/identity.ts';
import { productionCandidateCryptoPolicy, rejectUnsupportedPqHsmRequirement } from '../../mainnet/crypto-policy.ts';
import { bindCeremony, buildSimulatedCeremonyTranscript } from '../../mainnet/ceremony.ts';
import { PRODUCTION_CANDIDATE_PROTOCOL_VERSION } from '../../mainnet/identity.ts';
import { sevenProductionCandidateValidators } from '../../mainnet/validators.ts';
import { sha256File, sha256Text, generatedSourceDigest } from '../../supply-chain/inventory.ts';
import { freezeArtifacts, freezeDependencies, freezeProtocol } from '../freeze.ts';
import { FIRST_ECONOMIC_RC_ID, freezeEconomicPolicies } from '../economic/index.ts';
import {
  CEREMONY_EVIDENCE_CHUNK,
  ROOT_OF_TRUST_CHUNK,
  type MainnetCandidateV2Freeze,
  type MainnetCryptoFreeze,
  type MainnetEconomicFreeze,
  type MainnetProtocolFreeze,
  type MainnetProtocolFreezeKey,
  type MainnetRootOfTrustFreeze,
  type MainnetSourceFreeze,
} from './types.ts';

const PROTOCOL_PATHS: Readonly<Record<MainnetProtocolFreezeKey, readonly string[]>> = {
  transactionProtocol: [
    'packages/sunrey-chain/src/protocol/envelope.ts',
    'packages/sunrey-chain/src/protocol/codec.ts',
    'packages/sunrey-chain/schemas/srcb-v1.json',
  ],
  blockProtocol: [
    'packages/sunrey-chain/src/protocol/hash.ts',
    'packages/sunrey-chain/src/protocol/constants.ts',
  ],
  consensus: [
    'packages/sunrey-chain/src/ops/seven-validator.ts',
    'packages/sunrey-chain/src/mainnet/genesis-candidate.ts',
  ],
  validatorRules: [
    'packages/sunrey-chain/src/validators/types.ts',
    'packages/sunrey-chain/src/mainnet/validators.ts',
  ],
  executionRuntime: [
    'packages/sunrey-chain/src/protocol/state.ts',
    'packages/sunrey-chain/src/local-node/codec.ts',
  ],
  stateSchemas: [
    'packages/sunrey-chain/src/protocol/state.ts',
    'packages/sunrey-chain/src/protocol/assets.ts',
  ],
  p2pProtocol: [
    'packages/sunrey-chain/src/ops/sentry.ts',
    'packages/sunrey-chain/src/ops/topology.ts',
  ],
  governance: [
    'packages/sunrey-chain/src/governance/types.ts',
    'packages/sunrey-chain/src/governance/engine.ts',
  ],
  cryptoPolicy: [
    'packages/sunrey-chain/src/mainnet/crypto-policy.ts',
    'packages/security/src/pqc-library-selection.ts',
  ],
};

function digestPaths(root: string, paths: readonly string[]): string {
  return sha256Text(paths.map((rel) => `${rel}:${sha256File(root, rel) ?? `missing:${rel}`}`).join('\n'));
}

export function freezeMainnetProtocol(root: string): MainnetProtocolFreeze {
  const inherited = freezeProtocol(root);
  const hashes = Object.fromEntries(
    (Object.keys(PROTOCOL_PATHS) as MainnetProtocolFreezeKey[]).map((key) => [
      key,
      digestPaths(root, PROTOCOL_PATHS[key]),
    ]),
  ) as Record<MainnetProtocolFreezeKey, string>;
  return Object.freeze({
    protocolVersion: PRODUCTION_CANDIDATE_PROTOCOL_VERSION,
    hashes: Object.freeze(hashes),
    combinedHash: sha256Text(`${inherited.combinedHash}|${Object.values(hashes).join('|')}`),
  });
}

export function freezeMainnetSource(root: string, sourceCommit: string, releaseSignature: string): MainnetSourceFreeze {
  const deps = freezeDependencies(root);
  const artifacts = freezeArtifacts(root);
  const images = Object.freeze({
    ...deps.containerBaseDigests,
  });
  for (const [name, digest] of Object.entries(images)) {
    if (digest.length > 0 && !digest.startsWith('sha256:') && !/^[0-9a-f]{64}$/.test(digest)) {
      throw new TypeError(`floating container image rejected: ${name}`);
    }
  }
  const combined = sha256Text(
    [
      sourceCommit,
      deps.toolchain.rust,
      deps.toolchain.node,
      deps.npmLockDigest,
      deps.cargoLockRustDigest,
      deps.cargoLockNodeDigest,
      generatedSourceDigest(root),
      JSON.stringify(images),
      artifacts.combinedDigest,
    ].join('|'),
  );
  return Object.freeze({
    sourceCommit,
    rustToolchain: deps.toolchain.rust,
    nodeToolchain: deps.toolchain.node,
    npmLockDigest: deps.npmLockDigest,
    cargoLockRustDigest: deps.cargoLockRustDigest,
    cargoLockNodeDigest: deps.cargoLockNodeDigest,
    generatedProtocolSourcesDigest: generatedSourceDigest(root),
    containerImages: images,
    sbomDigest: artifacts.combinedDigest,
    provenanceDigest: deps.combinedDigest,
    releaseSignature,
    combinedDigest: combined,
  });
}

export function freezeMainnetEconomic(root: string, economicRcId = FIRST_ECONOMIC_RC_ID): MainnetEconomicFreeze {
  const policy = freezeEconomicPolicies(root);
  const validatorEconomicsHash = sha256Text(
    `${policy.hashes.validatorBondPolicy}|${policy.hashes.validatorRewardPolicy}|${policy.hashes.validatorPenaltyPolicy}`,
  );
  const combinedHash = sha256Text(
    [
      economicRcId,
      policy.combinedHash,
      policy.hashes.sunreyMonetaryPolicy,
      policy.hashes.moonreyMonetaryPolicy,
      policy.hashes.feePolicyV2,
      validatorEconomicsHash,
      policy.hashes.moonreyProductivePolicy,
      policy.hashes.protocolTreasuryPolicy,
    ].join('|'),
  );
  return Object.freeze({
    economicRcId,
    economicRcHash: policy.combinedHash,
    sunreyMonetaryPolicyHash: policy.hashes.sunreyMonetaryPolicy,
    moonreyMonetaryPolicyHash: policy.hashes.moonreyMonetaryPolicy,
    feePolicyV2Hash: policy.hashes.feePolicyV2,
    validatorEconomicsHash,
    moonreyIssuanceHash: policy.hashes.moonreyProductivePolicy,
    protocolTreasuryHash: policy.hashes.protocolTreasuryPolicy,
    combinedHash,
  });
}

export function freezeProductionNetworkCandidateV2(
  expectedRootHash?: string,
  root = process.cwd(),
): MainnetCandidateV2Freeze {
  if (ENVIRONMENT !== 'simulation') {
    throw new TypeError('mainnet RC may only bind a candidate while ENVIRONMENT is simulation');
  }
  const candidate = createProductionNetworkCandidateV2(root);
  if (candidate.candidateId !== CANDIDATE_V2_ID) {
    throw new TypeError(`wrong Candidate V2 rejected: ${candidate.candidateId}`);
  }
  if (expectedRootHash !== undefined && expectedRootHash !== candidate.candidateRootHash) {
    throw new TypeError(`wrong Candidate V2 rejected: expected ${expectedRootHash}, observed ${candidate.candidateRootHash}`);
  }
  return Object.freeze({
    candidateId: CANDIDATE_V2_ID,
    domain: CANDIDATE_V2_DOMAIN,
    genesisCandidateHash: candidate.genesisInput.inputHash,
    networkId: candidate.configuration.networkId,
    chainId: candidate.configuration.chainId,
    rootHash: candidate.candidateRootHash,
    mainnetEnabled: false,
    productionActivated: false,
  });
}

export function freezeMainnetCrypto(): MainnetCryptoFreeze {
  const policy = productionCandidateCryptoPolicy();
  rejectUnsupportedPqHsmRequirement(policy);
  return Object.freeze({
    policyId: policy.policyId,
    consensusSuiteId: policy.consensusSuiteId,
    pqRequiredForConsensus: false,
    hsmRequiredForConsensus: false,
    productionPqProvider: null,
    productionHsmProvider: null,
    testnetPqSoftwareSupported: true,
    cryptoAgile: true,
    digest: sha256Text(
      `${policy.policyId}|${policy.consensusSuiteId}|pqRequired=${String(policy.pqRequiredForConsensus)}|hsmRequired=${String(policy.hsmRequiredForConsensus)}`,
    ),
  });
}

export function freezeRootOfTrust(): MainnetRootOfTrustFreeze {
  const validators = sevenProductionCandidateValidators();
  const transcript = buildSimulatedCeremonyTranscript(validators);
  const binding = bindCeremony(transcript);
  return Object.freeze({
    architectureChunk: ROOT_OF_TRUST_CHUNK,
    ceremonyEvidenceChunk: CEREMONY_EVIDENCE_CHUNK,
    kind: 'SIMULATION_REHEARSAL',
    productionCeremonyEvidence: null,
    digest: sha256Text(`${binding.kind}|${binding.transcriptHash ?? 'none'}|${CEREMONY_EVIDENCE_CHUNK}`),
  });
}

export function rejectFloatingImage(digest: string): void {
  if (!digest.startsWith('sha256:') && !/^[0-9a-f]{64}$/.test(digest)) {
    throw new TypeError(`floating image rejected: ${digest}`);
  }
}

export function mainnetMaterialChange(
  left: { readonly sourceFreeze: MainnetSourceFreeze; readonly protocolFreeze: MainnetProtocolFreeze; readonly economicFreeze: MainnetEconomicFreeze; readonly candidateV2: MainnetCandidateV2Freeze },
  right: { readonly sourceFreeze: MainnetSourceFreeze; readonly protocolFreeze: MainnetProtocolFreeze; readonly economicFreeze: MainnetEconomicFreeze; readonly candidateV2: MainnetCandidateV2Freeze },
): boolean {
  return (
    left.sourceFreeze.combinedDigest !== right.sourceFreeze.combinedDigest ||
    left.protocolFreeze.combinedHash !== right.protocolFreeze.combinedHash ||
    left.economicFreeze.combinedHash !== right.economicFreeze.combinedHash ||
    left.candidateV2.rootHash !== right.candidateV2.rootHash
  );
}
