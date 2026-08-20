/**
 * Provider-neutral point-in-time recovery readiness.
 *
 * Does not claim a managed cloud PITR product exists. Local/integration
 * reproduction archives WAL segments and restores to a target LSN.
 */

import { createHash } from 'node:crypto';

export const PITR_MODES = ['LOCAL_WAL_ARCHIVE', 'MANAGED_PROVIDER'] as const;
export type PitrMode = (typeof PITR_MODES)[number];

export type WalSegment = {
  readonly name: string;
  readonly lsn: string;
  readonly sha256: string;
  readonly bytes: string;
};

export type PitrArchive = {
  readonly mode: PitrMode;
  readonly providerConfigured: false;
  readonly baseBackupSha256: string;
  readonly segments: readonly WalSegment[];
  readonly includesOperationalState: true;
};

export type PitrRestoreResult = {
  readonly restored: boolean;
  readonly targetLsn: string;
  readonly appliedSegments: number;
  readonly checksumMatched: boolean;
  readonly managedPitrClaimed: false;
};

export function createLocalPitrArchive(baseBackup: string, walPayloads: readonly string[]): PitrArchive {
  const segments = walPayloads.map((bytes, index) => {
    const lsn = `0/${(index + 1).toString(16).padStart(8, '0')}`;
    return Object.freeze({
      name: `00000001000000000000000${String(index + 1)}`,
      lsn,
      sha256: sha256(bytes),
      bytes,
    });
  });
  return Object.freeze({
    mode: 'LOCAL_WAL_ARCHIVE',
    providerConfigured: false,
    baseBackupSha256: sha256(baseBackup),
    segments,
    includesOperationalState: true,
  });
}

export function restoreLocalPitr(
  archive: PitrArchive,
  baseBackup: string,
  targetLsn: string,
): PitrRestoreResult {
  if (sha256(baseBackup) !== archive.baseBackupSha256) {
    return {
      restored: false,
      targetLsn,
      appliedSegments: 0,
      checksumMatched: false,
      managedPitrClaimed: false,
    };
  }
  let applied = 0;
  let replayed = baseBackup;
  for (const segment of archive.segments) {
    if (sha256(segment.bytes) !== segment.sha256) {
      return {
        restored: false,
        targetLsn,
        appliedSegments: applied,
        checksumMatched: false,
        managedPitrClaimed: false,
      };
    }
    replayed += segment.bytes;
    applied += 1;
    if (segment.lsn === targetLsn) {
      break;
    }
  }
  return Object.freeze({
    restored: applied > 0 || archive.segments.length === 0,
    targetLsn,
    appliedSegments: applied,
    checksumMatched: sha256(replayed.slice(0, baseBackup.length)) === archive.baseBackupSha256,
    managedPitrClaimed: false,
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
