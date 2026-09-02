import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { opsErr, opsOk, DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID, SNAPSHOT_FORMAT_VERSION, type OpsResult, type SnapshotManifest } from './types.ts';

export type ChainSnapshot = {
  readonly manifest: SnapshotManifest;
  readonly payload: string;
};

export type SnapshotTrust = {
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisFingerprint: string;
  readonly protocolVersion: string;
  readonly trustedFinalizedHeight: bigint;
  readonly trustedStateRoot?: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function genesisFingerprint(networkId: string, chainId: string, genesisHash: string): string {
  return sha256Hex([networkId, chainId, genesisHash].join('|'));
}

/** Deterministic development-network genesis fingerprint for engineering simulations. */
export const DEVELOPMENT_GENESIS_HASH = '00'.repeat(32);

export function developmentGenesisFingerprint(): string {
  return genesisFingerprint(DEVELOPMENT_NETWORK_ID, DEVELOPMENT_CHAIN_ID, DEVELOPMENT_GENESIS_HASH);
}

export function snapshotManifestHash(manifest: Omit<SnapshotManifest, 'manifestHash'>): string {
  return sha256Hex(
    [
      manifest.kind,
      manifest.networkId,
      manifest.chainId,
      manifest.genesisFingerprint,
      manifest.height.toString(),
      manifest.blockId,
      manifest.finalizedBlockId,
      manifest.stateRoot,
      manifest.protocolVersion,
      String(manifest.snapshotFormatVersion),
      String(manifest.storageSchema),
      manifest.validatorSetHash,
      manifest.validatorSetVersion.toString(),
      manifest.payloadHash,
      String(manifest.includesPrivateKey),
    ].join('|'),
  );
}

export function createSnapshot(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisFingerprint: string;
  readonly height: bigint;
  readonly blockId: string;
  readonly finalizedBlockId?: string;
  readonly stateRoot: string;
  readonly protocolVersion: string;
  readonly validatorSetHash: string;
  readonly validatorSetVersion: bigint;
  readonly payload: string;
  readonly createdAtUtc: string;
}): OpsResult<ChainSnapshot> {
  if (/private[_-]?key|seedHex|pkcs8/i.test(input.payload)) {
    return opsErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'snapshot must not include validator private keys');
  }
  if (/hin_|rawSubject|travelHistory|healthData|paymentCredential/i.test(input.payload)) {
    return opsErr('SNAPSHOT_TAMPER', 'snapshot must not include raw HIN or private economic data');
  }
  const payloadHash = sha256Hex(input.payload);
  const finalizedBlockId = input.finalizedBlockId ?? input.blockId;
  const unsigned = {
    kind: 'CHAIN_STATE' as const,
    networkId: input.networkId,
    chainId: input.chainId,
    genesisFingerprint: input.genesisFingerprint,
    height: input.height,
    blockId: input.blockId,
    finalizedBlockId,
    stateRoot: input.stateRoot,
    protocolVersion: input.protocolVersion,
    snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
    storageSchema: 1,
    validatorSetHash: input.validatorSetHash,
    validatorSetVersion: input.validatorSetVersion,
    payloadHash,
    createdAtUtc: input.createdAtUtc,
    includesPrivateKey: false as const,
  };
  const manifest: SnapshotManifest = { ...unsigned, manifestHash: snapshotManifestHash(unsigned) };
  return opsOk({ manifest, payload: input.payload });
}

export function verifySnapshot(snapshot: ChainSnapshot, trust: SnapshotTrust): OpsResult<true> {
  if (snapshot.manifest.includesPrivateKey) {
    return opsErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'snapshot claims to include a private key');
  }
  if (snapshot.manifest.snapshotFormatVersion !== SNAPSHOT_FORMAT_VERSION) {
    return opsErr('INCOMPATIBLE_PROTOCOL', 'snapshot format version is incompatible');
  }
  if (snapshot.manifest.networkId !== trust.networkId) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'snapshot network does not match the local network');
  }
  if (snapshot.manifest.chainId !== trust.chainId) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'snapshot chain does not match the local chain');
  }
  if (snapshot.manifest.genesisFingerprint !== trust.genesisFingerprint) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'snapshot genesis fingerprint does not match');
  }
  if (snapshot.manifest.protocolVersion !== trust.protocolVersion) {
    return opsErr('INCOMPATIBLE_PROTOCOL', 'snapshot protocol is incompatible');
  }
  if (snapshot.manifest.height > trust.trustedFinalizedHeight) {
    return opsErr('SNAPSHOT_TAMPER', 'snapshot height is ahead of the trusted finalized height');
  }
  if (trust.trustedStateRoot && snapshot.manifest.stateRoot !== trust.trustedStateRoot) {
    return opsErr('SNAPSHOT_TAMPER', 'snapshot state root does not match the trusted root');
  }
  if (sha256Hex(snapshot.payload) !== snapshot.manifest.payloadHash) {
    return opsErr('SNAPSHOT_TAMPER', 'snapshot payload hash mismatch');
  }
  const { manifestHash: _ignored, ...unsigned } = snapshot.manifest;
  if (snapshotManifestHash(unsigned) !== snapshot.manifest.manifestHash) {
    return opsErr('SNAPSHOT_TAMPER', 'snapshot manifest hash mismatch');
  }
  return opsOk(true);
}

export function persistSnapshot(directory: string, snapshot: ChainSnapshot): string {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `snapshot-${snapshot.manifest.height.toString()}.json`);
  const tmp = `${path}.tmp`;
  writeFileSync(
    tmp,
    JSON.stringify({
      manifest: {
        ...snapshot.manifest,
        height: snapshot.manifest.height.toString(),
        validatorSetVersion: snapshot.manifest.validatorSetVersion.toString(),
      },
      payload: snapshot.payload,
    }),
    { encoding: 'utf8', mode: 0o600 },
  );
  renameSync(tmp, path);
  return path;
}

export function loadSnapshot(path: string): ChainSnapshot {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    manifest: SnapshotManifest & { height: string; validatorSetVersion: string };
    payload: string;
  };
  return {
    manifest: {
      ...raw.manifest,
      height: BigInt(raw.manifest.height),
      validatorSetVersion: BigInt(raw.manifest.validatorSetVersion),
    },
    payload: raw.payload,
  };
}

export function restoreSnapshot(
  snapshot: ChainSnapshot,
  trust: SnapshotTrust,
  dataDirectory: string,
): OpsResult<{ readonly height: bigint; readonly stateRoot: string; readonly path: string }> {
  const verified = verifySnapshot(snapshot, trust);
  if (!verified.ok) {
    return verified;
  }
  const path = persistSnapshot(join(dataDirectory, 'restored'), snapshot);
  if (!existsSync(dirname(path))) {
    return opsErr('SNAPSHOT_TAMPER', 'restore path missing');
  }
  return opsOk({
    height: snapshot.manifest.height,
    stateRoot: snapshot.manifest.stateRoot,
    path,
  });
}
