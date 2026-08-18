/**
 * Key-purpose separation, fixture/testnet/rehearsal detection, and
 * duplicate high-risk fingerprint rejection.
 *
 * One key cannot silently acquire another purpose. CI never writes
 * production private-key material.
 */

import {
  AUTHORITY_PURPOSE,
  type RootOfTrustAuthority,
} from '../../../security/src/ceremony/authorities.ts';
import { createEd25519SignatureProvider, SUITE_SUNREY_ED25519_V1, type KeyPurpose } from '../../../security/src/index.ts';
import { FIXTURE_KEY_MARKER, assertFixtureEnvironment } from '../testnet/security.ts';
import { sevenValidatorFixture } from '../testnet/validators.ts';
import { sevenProductionCandidateValidators } from '../mainnet/validators.ts';
import { sevenRehearsalValidators } from '../launch-rehearsal/genesis.ts';
import { sevenEconomicRehearsalValidators } from '../economic-rehearsal/genesis.ts';
import { sevenShadowValidators } from '../pregenesis/genesis.ts';
import { encodeString, sha256Bytes, sha256Hex } from '../validators/canonical.ts';
import type { HighRiskKeyPurpose, ProductionKeyPurpose } from './types.ts';
import { HIGH_RISK_KEY_PURPOSES } from './types.ts';

export const PURPOSE_TO_CANONICAL: Readonly<Record<ProductionKeyPurpose, KeyPurpose>> = Object.freeze({
  VALIDATOR_CONSENSUS: 'VALIDATOR_CONSENSUS_SIGNING',
  VALIDATOR_P2P: 'P2P_IDENTITY',
  VALIDATOR_GOVERNANCE: 'GOVERNANCE_SIGNING',
  PROTOCOL_GOVERNANCE: 'GOVERNANCE_SIGNING',
  SECURITY_GOVERNANCE: 'GOVERNANCE_SIGNING',
  RELEASE_AUTHORITY: 'RELEASE_SIGNING',
  GENESIS_AUTHORITY: 'GENESIS_SIGNING',
  RECOVERY_AUTHORITY: 'RECOVERY_SIGNING',
  CUSTODY_SIGNING: 'WALLET_SIGNING',
  ORACLE_SIGNING: 'ORACLE_SIGNING',
});

export const INCOMPATIBLE_PURPOSE_PAIRS: ReadonlyArray<readonly [ProductionKeyPurpose, ProductionKeyPurpose]> =
  Object.freeze([
    ['VALIDATOR_CONSENSUS', 'CUSTODY_SIGNING'],
    ['VALIDATOR_CONSENSUS', 'RELEASE_AUTHORITY'],
    ['VALIDATOR_CONSENSUS', 'GENESIS_AUTHORITY'],
    ['RELEASE_AUTHORITY', 'GENESIS_AUTHORITY'],
    ['RELEASE_AUTHORITY', 'PROTOCOL_GOVERNANCE'],
    ['RECOVERY_AUTHORITY', 'PROTOCOL_GOVERNANCE'],
    ['RECOVERY_AUTHORITY', 'GENESIS_AUTHORITY'],
    ['CUSTODY_SIGNING', 'ORACLE_SIGNING'],
    ['CUSTODY_SIGNING', 'PROTOCOL_GOVERNANCE'],
    ['GENESIS_AUTHORITY', 'ORACLE_SIGNING'],
    ['VALIDATOR_P2P', 'VALIDATOR_CONSENSUS'],
    ['VALIDATOR_P2P', 'GENESIS_AUTHORITY'],
  ]);

export function fingerprintOf(publicKeyHex: string): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.key.fingerprint.v1'), encodeString(publicKeyHex.toLowerCase())]));
}

export function assertPurposeSeparation(purpose: ProductionKeyPurpose, requested: ProductionKeyPurpose): void {
  if (purpose !== requested) {
    throw new TypeError(`key purpose ${purpose} cannot silently acquire ${requested}`);
  }
}

export function assertAuthorityPurpose(authority: RootOfTrustAuthority, purpose: KeyPurpose): void {
  if (AUTHORITY_PURPOSE[authority] !== purpose) {
    throw new TypeError(`${authority} cannot operate as ${purpose}`);
  }
}

export function purposesShareFingerprintAllowed(left: ProductionKeyPurpose, right: ProductionKeyPurpose): boolean {
  if (left === right) {
    return true;
  }
  return !INCOMPATIBLE_PURPOSE_PAIRS.some(
    ([a, b]) => (a === left && b === right) || (a === right && b === left),
  );
}

export function rejectDuplicateHighRiskKeys(
  bindings: readonly { readonly purpose: ProductionKeyPurpose; readonly publicKeyHex: string }[],
): void {
  const seen = new Map<string, ProductionKeyPurpose>();
  for (const row of bindings) {
    const fingerprint = fingerprintOf(row.publicKeyHex);
    const prior = seen.get(fingerprint);
    if (prior && prior !== row.purpose && (HIGH_RISK_KEY_PURPOSES as readonly string[]).includes(row.purpose)) {
      if (!purposesShareFingerprintAllowed(prior, row.purpose)) {
        throw new TypeError(`duplicate high-risk key rejected across ${prior} and ${row.purpose}`);
      }
    }
    if (
      prior &&
      (HIGH_RISK_KEY_PURPOSES as readonly HighRiskKeyPurpose[]).includes(row.purpose as HighRiskKeyPurpose) &&
      prior !== row.purpose
    ) {
      throw new TypeError(`duplicate high-risk key rejected across ${prior} and ${row.purpose}`);
    }
    seen.set(fingerprint, row.purpose);
  }
}

function collectKnownFixtureKeys(): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const row of sevenValidatorFixture()) {
    keys.add(row.consensusPublicKeyHex.toLowerCase());
    keys.add(row.p2pPublicKeyHex.toLowerCase());
    keys.add(row.governancePublicKeyHex.toLowerCase());
  }
  for (const row of sevenProductionCandidateValidators()) {
    keys.add(row.consensusPublicKeyHex.toLowerCase());
    keys.add(row.p2pPublicKeyHex.toLowerCase());
    keys.add(row.governancePublicKeyHex.toLowerCase());
  }
  for (const row of sevenRehearsalValidators()) {
    keys.add(row.consensusPublicKeyHex.toLowerCase());
    keys.add(row.p2pPublicKeyHex.toLowerCase());
    keys.add(row.governancePublicKeyHex.toLowerCase());
  }
  for (const row of sevenEconomicRehearsalValidators()) {
    keys.add(row.consensusPublicKeyHex.toLowerCase());
    keys.add(row.p2pPublicKeyHex.toLowerCase());
    keys.add(row.governancePublicKeyHex.toLowerCase());
  }
  for (const row of sevenShadowValidators()) {
    keys.add(row.consensusPublicKeyHex.toLowerCase());
    keys.add(row.p2pPublicKeyHex.toLowerCase());
    keys.add(row.governancePublicKeyHex.toLowerCase());
  }
  return keys;
}

export function knownFixturePublicKeys(): ReadonlySet<string> {
  return collectKnownFixtureKeys();
}

export function isForbiddenProductionKeyLabel(label: string): boolean {
  if (!label.includes(FIXTURE_KEY_MARKER) && /testnet|development|rehearsal|fixture/i.test(label)) {
    return true;
  }
  return /SUNREY_TESTNET_|SUNREY_LOCAL_DEV_|SUNREY_DEV_|SUNREY_MAINNET_REHEARSAL_|SUNREY_ECONOMIC_MAINNET_REHEARSAL_|SUNREY_PRODUCTION_CANDIDATE_1_FIXTURE_|SUNREY_PREGENESIS_SHADOW_/i.test(
    label,
  );
}

export function rejectFixtureTestnetRehearsalKeys(
  keys: readonly { readonly publicKeyHex: string; readonly label?: string },
  options: { readonly allowDressRehearsalLabels?: boolean } = {},
): void {
  const known = collectKnownFixtureKeys();
  for (const key of keys) {
    const hex = key.publicKeyHex.toLowerCase();
    if (known.has(hex)) {
      throw new TypeError('testnet, development, rehearsal, or fixture key rejected from production ceremony inputs');
    }
    if (key.label && isForbiddenProductionKeyLabel(key.label)) {
      if (options.allowDressRehearsalLabels && key.label.includes('PRODUCTION_GENESIS_CEREMONY_REHEARSAL')) {
        continue;
      }
      throw new TypeError(`forbidden fixture/rehearsal/testnet key label rejected: ${key.label}`);
    }
  }
}

export function rejectTestnetKey(publicKeyHex: string): void {
  const testnet = sevenValidatorFixture();
  const set = new Set(
    testnet.flatMap((row) => [
      row.consensusPublicKeyHex.toLowerCase(),
      row.p2pPublicKeyHex.toLowerCase(),
      row.governancePublicKeyHex.toLowerCase(),
    ]),
  );
  if (set.has(publicKeyHex.toLowerCase())) {
    throw new TypeError('testnet key rejected from production ceremony inputs');
  }
}

export function rejectRehearsalKey(publicKeyHex: string): void {
  const rehearsal = [...sevenRehearsalValidators(), ...sevenEconomicRehearsalValidators()];
  const set = new Set(
    rehearsal.flatMap((row) => [
      row.consensusPublicKeyHex.toLowerCase(),
      row.p2pPublicKeyHex.toLowerCase(),
      row.governancePublicKeyHex.toLowerCase(),
    ]),
  );
  if (set.has(publicKeyHex.toLowerCase())) {
    throw new TypeError('rehearsal validator key rejected from production ceremony inputs');
  }
}

export function deriveSimulationPublicKey(label: string, purpose: KeyPurpose, keyId: string): string {
  assertFixtureEnvironment();
  if (!label.includes(FIXTURE_KEY_MARKER)) {
    throw new TypeError('simulation ceremony keys must carry NOT_FOR_PRODUCTION');
  }
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(label, 'utf8'));
  const derived = provider.fromSeed(seed.toString('hex'), purpose, SUITE_SUNREY_ED25519_V1, keyId);
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function signSimulationChallenge(
  label: string,
  purpose: KeyPurpose,
  keyId: string,
  message: Buffer,
): { readonly publicKeyHex: string; readonly signatureHex: string } {
  assertFixtureEnvironment();
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(label, 'utf8'));
  const derived = provider.fromSeed(seed.toString('hex'), purpose, SUITE_SUNREY_ED25519_V1, keyId);
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  const signed = provider.signRaw(
    derived.value.privateKey.reveal().toString('hex'),
    derived.value.publicKey.publicKeyHex,
    message,
  );
  if (!signed.ok) {
    throw new Error(signed.error.message);
  }
  return {
    publicKeyHex: derived.value.publicKey.publicKeyHex,
    signatureHex: signed.value.toString('hex'),
  };
}

export function verifySimulationChallenge(publicKeyHex: string, message: Buffer, signatureHex: string): boolean {
  const provider = createEd25519SignatureProvider();
  const verified = provider.verifyRaw(publicKeyHex, message, signatureHex);
  return verified.ok;
}
