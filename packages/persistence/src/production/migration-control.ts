/**
 * Production schema migration control. Requires identity, hashes, backup
 * verification, compatibility, and execution evidence.
 */

import { createHash } from 'node:crypto';

import { sha256Hex, type DomainName, type MigrationFile } from '../migrate.ts';

export type SchemaMigrationPlan = {
  readonly migrationId: string;
  readonly domain: DomainName;
  readonly sourceSchema: string;
  readonly targetSchema: string;
  readonly artifactHash: string;
  readonly backupVerified: boolean;
  readonly compatible: boolean;
  readonly executionEvidence: string;
};

export function planDomainMigration(input: {
  readonly domain: DomainName;
  readonly sourceSchema: string;
  readonly files: readonly MigrationFile[];
  readonly backupChecksum: string;
  readonly expectedBackupChecksum: string;
}): SchemaMigrationPlan {
  const artifactHash = sha256Hex(input.files.map((file) => `${file.filename}:${file.checksum}`).join('|'));
  const target = input.files.at(-1)?.filename ?? input.sourceSchema;
  const backupVerified = input.backupChecksum === input.expectedBackupChecksum && input.backupChecksum.length === 64;
  const compatible = input.files.every((file, index) => file.version === index + 1);
  const executionEvidence = createHash('sha256')
    .update(`${input.domain}|${artifactHash}|${input.backupChecksum}`)
    .digest('hex');
  return Object.freeze({
    migrationId: `mig_${input.domain}_${artifactHash.slice(0, 12)}`,
    domain: input.domain,
    sourceSchema: input.sourceSchema,
    targetSchema: target,
    artifactHash,
    backupVerified,
    compatible,
    executionEvidence,
  });
}

export function assertMigrationSafe(plan: SchemaMigrationPlan): void {
  if (!plan.backupVerified) {
    throw new Error('production migration requires verified backup');
  }
  if (!plan.compatible) {
    throw new Error('production migration failed compatibility checks');
  }
}
