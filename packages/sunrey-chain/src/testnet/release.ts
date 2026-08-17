/**
 * Release manifest, SBOM (CycloneDX), and artifact signing port.
 *
 * Signing uses established Ed25519 — no invented algorithm.
 * When CI credentials are absent, a local/test key path is used.
 */

import { createHash } from 'node:crypto';
import { createEd25519SignatureProvider, SUITE_SUNREY_ED25519_V1 } from '../../../security/src/index.ts';
import { seedFromLabel } from '../wallet/keys.ts';
import { GENESIS_TOOL_VERSION } from './genesis.ts';
import { FIXTURE_KEY_MARKER } from './security.ts';

export type ReleaseManifest = {
  readonly sourceCommit: string;
  readonly rustToolchain: string;
  readonly nodeToolchain: string;
  readonly dependencyLockHashes: {
    readonly packageLock: string;
    readonly cargoLock: string;
  };
  readonly imageDigest: string;
  readonly binaryHashes: Readonly<Record<string, string>>;
  readonly protocolSchemaHash: string;
  readonly genesisToolVersion: typeof GENESIS_TOOL_VERSION;
  readonly environment: 'simulation';
};

export type SbomDocument = {
  readonly bomFormat: 'CycloneDX';
  readonly specVersion: '1.5';
  readonly version: 1;
  readonly metadata: {
    readonly component: { readonly name: 'sunrey-testnet'; readonly type: 'application' };
  };
  readonly components: readonly { readonly name: string; readonly version: string; readonly hashes: readonly { readonly alg: 'SHA-256'; readonly content: string }[] }[];
};

export type SigningProvider = {
  readonly name: 'ED25519_V1' | 'COSIGN_PORT';
  sign(bytes: Uint8Array): { readonly publicKeyHex: string; readonly signatureHex: string; readonly suiteId: string };
  verify(bytes: Uint8Array, publicKeyHex: string, signatureHex: string): boolean;
};

export function localTestSigningProvider(): SigningProvider {
  const provider = createEd25519SignatureProvider();
  const seed = Buffer.from(seedFromLabel(`SUNREY_TESTNET_RELEASE_SIGNING_${FIXTURE_KEY_MARKER}_v1`));
  const derived = provider.fromSeed(seed.toString('hex'), 'ATTESTATION_SIGNING', SUITE_SUNREY_ED25519_V1, 'testnet-release');
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  const key = derived.value;
  return {
    name: 'ED25519_V1',
    sign(bytes) {
      const signed = provider.signRaw(seed.toString('hex'), key.publicKey.publicKeyHex, Buffer.from(bytes));
      if (!signed.ok) {
        throw new Error(signed.error.message);
      }
      return {
        publicKeyHex: key.publicKey.publicKeyHex,
        signatureHex: signed.value.toString('hex'),
        suiteId: SUITE_SUNREY_ED25519_V1,
      };
    },
    verify(bytes, publicKeyHex, signatureHex) {
      const verified = provider.verifyRaw(publicKeyHex, Buffer.from(bytes), signatureHex);
      return verified.ok;
    },
  };
}

export function buildReleaseManifest(input: {
  readonly sourceCommit: string;
  readonly packageLock: string;
  readonly cargoLock: string;
  readonly schema: string;
  readonly binaries?: Readonly<Record<string, string>>;
  readonly imageDigest?: string;
}): ReleaseManifest {
  return Object.freeze({
    sourceCommit: input.sourceCommit,
    rustToolchain: '1.83.0',
    nodeToolchain: '22',
    dependencyLockHashes: Object.freeze({
      packageLock: sha256Text(input.packageLock),
      cargoLock: sha256Text(input.cargoLock),
    }),
    imageDigest: input.imageDigest ?? 'sha256:local-unsigned',
    binaryHashes: input.binaries ?? Object.freeze({}),
    protocolSchemaHash: sha256Text(input.schema),
    genesisToolVersion: GENESIS_TOOL_VERSION,
    environment: 'simulation',
  });
}

export function buildCycloneDxSbom(components: readonly { readonly name: string; readonly version: string; readonly content: string }[]): SbomDocument {
  return Object.freeze({
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: Object.freeze({
      component: Object.freeze({ name: 'sunrey-testnet', type: 'application' }),
    }),
    components: components.map((row) =>
      Object.freeze({
        name: row.name,
        version: row.version,
        hashes: Object.freeze([{ alg: 'SHA-256' as const, content: sha256Text(row.content) }]),
      }),
    ),
  });
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
