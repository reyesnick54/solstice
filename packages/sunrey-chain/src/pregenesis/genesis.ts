/**
 * Distinct shadow genesis and fixture keys.
 *
 * Same protocol shape as the production candidate. Isolated identity,
 * test-only keys, zero economic-value supply. Unusable as production
 * genesis or production authorization.
 */

import { SUITE_SUNREY_ED25519_V1, createEd25519SignatureProvider, type KeyPurpose } from '../../../security/src/index.ts';
import { FIXTURE_KEY_MARKER, assertFixtureEnvironment } from '../testnet/security.ts';
import { CANDIDATE_MODULE_REGISTRY, defaultConsensusParameters } from '../mainnet/genesis-candidate.ts';
import { allocationManifestHash, emptyAllocationManifest } from '../mainnet/allocation.ts';
import { encodeString, encodeU32, encodeU64, sha256Bytes, sha256Hex } from '../validators/canonical.ts';
import { commitCanonical } from '../hash.ts';
import {
  PREGENESIS_ADDRESS_HRP,
  PREGENESIS_CHAIN_ID,
  PREGENESIS_DISPLAY_NAME,
  PREGENESIS_DOMAIN,
  PREGENESIS_FIXTURE_GENESIS_TIME_MS,
  PREGENESIS_GENESIS_VERSION,
  PREGENESIS_NETWORK_ID,
  PREGENESIS_PROTOCOL_VERSION,
  assertPregenesisIdentity,
} from './identity.ts';

export const PREGENESIS_VALIDATOR_COUNT = 7 as const;
export const PREGENESIS_VALIDATOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type PregenesisValidatorLabel = (typeof PREGENESIS_VALIDATOR_LABELS)[number];

const ROLE_LABEL = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
} as const;

export type PregenesisValidatorPublic = {
  readonly validatorId: string;
  readonly label: PregenesisValidatorLabel;
  readonly votingPower: bigint;
  readonly consensusPublicKeyHex: string;
  readonly p2pPublicKeyHex: string;
  readonly governancePublicKeyHex: string;
  readonly consensusKeyLabel: string;
  readonly fixtureKey: true;
  readonly productionEligible: false;
};

export function shadowKeyLabel(
  validator: PregenesisValidatorLabel,
  role: keyof typeof ROLE_LABEL,
): string {
  return `SUNREY_PREGENESIS_SHADOW_1_FIXTURE_VALIDATOR_${validator}_${ROLE_LABEL[role]}_${FIXTURE_KEY_MARKER}_v1`;
}

function publicKeyFromLabel(
  validator: PregenesisValidatorLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
): string {
  assertFixtureEnvironment();
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(shadowKeyLabel(validator, role), 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `pregenesis-shadow-fixture:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function sevenShadowValidators(): readonly PregenesisValidatorPublic[] {
  return Object.freeze(
    PREGENESIS_VALIDATOR_LABELS.map((label) =>
      Object.freeze({
        validatorId: `val_pregenesis_shadow_1_${label.toLowerCase()}`,
        label,
        votingPower: 1n,
        consensusPublicKeyHex: publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING'),
        p2pPublicKeyHex: publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY'),
        governancePublicKeyHex: publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING'),
        consensusKeyLabel: shadowKeyLabel(label, 'consensus'),
        fixtureKey: true,
        productionEligible: false,
      }),
    ),
  );
}

export function shadowValidatorSetHash(validators = sevenShadowValidators()): string {
  return commitCanonical({
    domain: PREGENESIS_DOMAIN,
    label: 'validator-set',
    validators: validators.map((row) => ({
      validatorId: row.validatorId,
      consensusPublicKeyHex: row.consensusPublicKeyHex,
      votingPower: row.votingPower.toString(),
    })),
  });
}

export type PregenesisGenesisBundle = {
  readonly displayName: typeof PREGENESIS_DISPLAY_NAME;
  readonly networkId: typeof PREGENESIS_NETWORK_ID;
  readonly chainId: typeof PREGENESIS_CHAIN_ID;
  readonly addressHrp: typeof PREGENESIS_ADDRESS_HRP;
  readonly genesisVersion: typeof PREGENESIS_GENESIS_VERSION;
  readonly protocolVersion: typeof PREGENESIS_PROTOCOL_VERSION;
  readonly genesisTimeMs: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly allocationHash: string;
  readonly moduleRegistryHash: string;
  readonly consensusParametersHash: string;
  readonly sunreyGenesisSupply: '0';
  readonly moonreyGenesisSupply: '0';
  readonly usableAsProductionGenesis: false;
  readonly verification: { readonly ok: true };
};

export function buildShadowGenesis(validators = sevenShadowValidators()): PregenesisGenesisBundle {
  assertPregenesisIdentity(PREGENESIS_NETWORK_ID, PREGENESIS_CHAIN_ID, PREGENESIS_ADDRESS_HRP);
  const allocation = emptyAllocationManifest();
  const consensus = defaultConsensusParameters();
  const validatorSetHash = shadowValidatorSetHash(validators);
  const moduleRegistryHash = commitCanonical({ domain: PREGENESIS_DOMAIN, modules: CANDIDATE_MODULE_REGISTRY });
  const consensusParametersHash = commitCanonical({ domain: PREGENESIS_DOMAIN, consensus });
  const body = {
    tag: 'PregenesisShadowGenesisV1',
    displayName: PREGENESIS_DISPLAY_NAME,
    networkId: PREGENESIS_NETWORK_ID,
    chainId: PREGENESIS_CHAIN_ID,
    addressHrp: PREGENESIS_ADDRESS_HRP,
    genesisVersion: PREGENESIS_GENESIS_VERSION,
    protocolVersion: PREGENESIS_PROTOCOL_VERSION,
    genesisTimeMs: PREGENESIS_FIXTURE_GENESIS_TIME_MS.toString(),
    validatorSetHash,
    allocationHash: allocationManifestHash(allocation),
    moduleRegistryHash,
    consensusParametersHash,
    sunreyGenesisSupply: '0',
    moonreyGenesisSupply: '0',
  };
  const encoded = Buffer.concat([
    encodeString(PREGENESIS_DOMAIN),
    encodeString(body.tag),
    encodeString(body.networkId),
    encodeString(body.chainId),
    encodeString(body.addressHrp),
    encodeU64(PREGENESIS_FIXTURE_GENESIS_TIME_MS),
    encodeU32(validators.length),
    encodeString(validatorSetHash),
  ]);
  return Object.freeze({
    ...body,
    genesisHash: sha256Hex(encoded),
    usableAsProductionGenesis: false,
    verification: Object.freeze({ ok: true as const }),
  });
}

export function rejectShadowGenesisAsProduction(genesisHash: string, productionGenesisHash: string): void {
  if (genesisHash === productionGenesisHash) {
    throw new TypeError('shadow genesis must not equal production genesis');
  }
  const shadow = buildShadowGenesis();
  if (genesisHash === shadow.genesisHash) {
    throw new TypeError('shadow genesis rejected from production');
  }
}
