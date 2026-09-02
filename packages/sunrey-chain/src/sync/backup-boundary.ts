/**
 * Wave 2 — backup boundary definitions.
 *
 * Canonical chain store, validator keys, application databases, and Evidence
 * Vault remain distinct backup classes. Key backups require stronger
 * operational security than ordinary chain-data backups.
 */

import { backupRecoveryStrategies } from '../ops/backup.ts';
import { BACKUP_CLASSES } from '../ops/types.ts';

export const WAVE2_BACKUP_BOUNDARIES = Object.freeze([
  {
    backupClass: 'BLOCKCHAIN_STATE' as const,
    scope: 'Canonical chain store (blocks, state, metadata)',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: false,
    encryptionRequired: false,
    strongerOpsSecurity: false,
    commitToRepository: false,
  },
  {
    backupClass: 'CONSENSUS_WAL' as const,
    scope: 'Append-only consensus WAL',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: false,
    encryptionRequired: false,
    strongerOpsSecurity: false,
    commitToRepository: false,
  },
  {
    backupClass: 'SIGNER_SAFETY' as const,
    scope: 'Signer high-watermark and fencing metadata',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: false,
    encryptionRequired: true,
    strongerOpsSecurity: true,
    commitToRepository: false,
  },
  {
    backupClass: 'VALIDATOR_CONFIGURATION' as const,
    scope: 'Non-secret validator placement and topology',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: false,
    encryptionRequired: false,
    strongerOpsSecurity: false,
    commitToRepository: false,
  },
  {
    backupClass: 'POSTGRES_APPLICATION_DATA' as const,
    scope: 'Application databases (ledger projections, outbox, custody metadata)',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: true,
    encryptionRequired: true,
    strongerOpsSecurity: false,
    commitToRepository: false,
  },
  {
    backupClass: 'CUSTODY_METADATA' as const,
    scope: 'Custody operational metadata; canonical quantity remains on chain',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: true,
    encryptionRequired: true,
    strongerOpsSecurity: true,
    commitToRepository: false,
  },
  {
    backupClass: 'ENCRYPTED_CONFIGURATION' as const,
    scope: 'Operator configuration and security metadata references',
    includesPrivateKeys: false,
    includesEvidenceVault: false,
    includesApplicationDb: false,
    encryptionRequired: true,
    strongerOpsSecurity: true,
    commitToRepository: false,
  },
]);

export const VALIDATOR_KEY_BACKUP_BOUNDARY = Object.freeze({
  backupClass: 'VALIDATOR_KEYS' as const,
  scope: 'Validator private keys and HSM references',
  includesPrivateKeys: true,
  includesEvidenceVault: false,
  includesApplicationDb: false,
  encryptionRequired: true,
  strongerOpsSecurity: true,
  commitToRepository: false,
  note: 'Never commit key backups to the repository. Separate from chain-state backups.',
});

export const EVIDENCE_VAULT_BACKUP_BOUNDARY = Object.freeze({
  backupClass: 'EVIDENCE_VAULT' as const,
  scope: 'Hash-chained Evidence Vault (platform compliance plane)',
  includesPrivateKeys: false,
  includesEvidenceVault: true,
  includesApplicationDb: false,
  encryptionRequired: true,
  strongerOpsSecurity: true,
  commitToRepository: false,
  note: 'Distinct from chain store. Does not substitute for blockchain recovery.',
});

export function assertBackupBoundariesDistinct(): boolean {
  const strategies = backupRecoveryStrategies();
  if (strategies.length !== BACKUP_CLASSES.length) {
    return false;
  }
  const chain = WAVE2_BACKUP_BOUNDARIES.find((row) => row.backupClass === 'BLOCKCHAIN_STATE');
  const keys = VALIDATOR_KEY_BACKUP_BOUNDARY;
  const evidence = EVIDENCE_VAULT_BACKUP_BOUNDARY;
  return chain !== undefined && !chain.includesPrivateKeys && keys.includesPrivateKeys && !keys.commitToRepository && !evidence.commitToRepository;
}
