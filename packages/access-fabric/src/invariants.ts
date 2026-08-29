import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  FORBIDDEN_SCORE_FIELDS,
  FORBIDDEN_SENSITIVE_DEPENDENCIES,
} from './taxonomy.ts';
import type { AccessEntitlement, AccessFabricFailure } from './types.ts';

const FORBIDDEN_KEY_SET = new Set<string>([
  ...FORBIDDEN_SCORE_FIELDS,
  ...FORBIDDEN_SENSITIVE_DEPENDENCIES,
]);

function failure(code: AccessFabricFailure['code'], message: string): AccessFabricFailure {
  return Object.freeze({ code, message });
}

function walkKeys(value: unknown, keys: { readonly key: string; readonly value: unknown }[]): void {
  if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeys(item, keys);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      keys.push({ key, value: item });
      walkKeys(item, keys);
    }
  }
}

export function scanForbiddenAccessPayload(input: unknown): Result<true, AccessFabricFailure> {
  const keys: { readonly key: string; readonly value: unknown }[] = [];
  walkKeys(input, keys);
  for (const entry of keys) {
    const key = entry.key;
    const lower = key.toLowerCase();
    if (key === 'humanWorthScore' && entry.value === false) {
      continue;
    }
    if (FORBIDDEN_KEY_SET.has(key) || FORBIDDEN_KEY_SET.has(lower)) {
      if ((FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key) || (FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(lower)) {
        return err(failure('HUMAN_WORTH_SCORE_FORBIDDEN', `human-worth or reputation score field '${key}' is forbidden in access fabric`));
      }
      if (key === 'rawPdvContent' || key === 'rawPdv' || key === 'raw_pdv') {
        return err(failure('RAW_PDV_CONTENT_FORBIDDEN', 'raw Personal Data Vault content cannot drive access eligibility'));
      }
      return err(failure('SENSITIVE_DATA_DEPENDENCE_FORBIDDEN', `unauthorized sensitive dependency '${key}' is forbidden in access fabric`));
    }
  }
  return ok(true);
}

export function assertAccessEntitlementInvariants(entitlement: AccessEntitlement): Result<true, AccessFabricFailure> {
  if (entitlement.humanWorthScore !== false) {
    return err(failure('HUMAN_WORTH_SCORE_FORBIDDEN', 'AccessEntitlement must keep humanWorthScore=false'));
  }
  if (entitlement.isMonetaryAsset !== false) {
    return err(failure('MONETARY_ASSET_FORBIDDEN', 'AccessEntitlement is not cryptocurrency, bank money, or securities'));
  }
  if (entitlement.isTransferableBalance !== false) {
    return err(failure('TRANSFERABLE_BALANCE_FORBIDDEN', 'AccessEntitlement is not a transferable balance ledger'));
  }
  return scanForbiddenAccessPayload(entitlement);
}

export function accessFabricIsNotHumanWorthScoring(): false {
  return false;
}
