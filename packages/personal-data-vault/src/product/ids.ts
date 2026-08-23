import { brandAs, type Brand } from '../../../domain/src/brand.ts';
import { newSecurityToken } from '../../../security/src/random.ts';

export type VaultCorrectionId = Brand<string, 'VaultCorrectionId'>;
export type VaultExportJobId = Brand<string, 'VaultExportJobId'>;

export function newVaultCorrectionId(): VaultCorrectionId {
  return brandAs<string, 'VaultCorrectionId'>(`pdcor_${newSecurityToken()}`);
}

export function newVaultExportJobId(): VaultExportJobId {
  return brandAs<string, 'VaultExportJobId'>(`pdxj_${newSecurityToken()}`);
}
