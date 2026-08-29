import { err, ok, type Result } from '../../domain/src/result.ts';
import { isUtcInstant } from '../../domain/src/time.ts';
import {
  FORBIDDEN_ACCESS_SCORE_FIELDS,
  FORBIDDEN_ACCESS_TOKEN_FIELDS,
  isAccessBoundKind,
  isAccessCapacityCategory,
  isAccessIntentKind,
  isAccessRightState,
} from './taxonomy.ts';
import type {
  AccessBound,
  AccessFabricFailure,
  ProposeAccessIntentInput,
  RegisterAccessRightInput,
} from './registry-types.ts';

const FORBIDDEN_KEY_SET = new Set<string>([
  ...FORBIDDEN_ACCESS_SCORE_FIELDS,
  ...FORBIDDEN_ACCESS_TOKEN_FIELDS,
  'isOwnership',
  'tokenizesTitle',
  'mintAuthority',
  'settlementInstruction',
  'executionAuthority',
]);

function failure(code: AccessFabricFailure['code'], message: string): AccessFabricFailure {
  return Object.freeze({ code, message });
}

function walkKeys(value: unknown, keys: string[]): void {
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return;
  }
  if (typeof value === 'string') {
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
      keys.push(key);
      walkKeys(item, keys);
    }
  }
}

export function scanForbiddenAccessPayload(input: unknown): Result<true, AccessFabricFailure> {
  const keys: string[] = [];
  walkKeys(input, keys);
  for (const key of keys) {
    if (FORBIDDEN_KEY_SET.has(key)) {
      if ((FORBIDDEN_ACCESS_SCORE_FIELDS as readonly string[]).includes(key)) {
        return err(failure('FORBIDDEN_HUMAN_WORTH_FIELD', `Forbidden human-worth or score field: ${key}`));
      }
      if ((FORBIDDEN_ACCESS_TOKEN_FIELDS as readonly string[]).includes(key)) {
        return err(failure('FORBIDDEN_ACCESS_COIN_FIELD', `Forbidden access-coin or peg field: ${key}`));
      }
      if (key === 'isOwnership' || key === 'tokenizesTitle') {
        return err(failure('FORBIDDEN_OWNERSHIP_CLAIM', `Access fabric does not model ownership via ${key}`));
      }
      if (key === 'mintAuthority') {
        return err(failure('FORBIDDEN_MINT_CLAIM', 'Access fabric does not authorize minting'));
      }
      if (key === 'settlementInstruction') {
        return err(failure('FORBIDDEN_SETTLEMENT_CLAIM', 'Access fabric does not imply settlement'));
      }
      if (key === 'executionAuthority') {
        return err(failure('FORBIDDEN_SETTLEMENT_CLAIM', 'Access fabric does not issue Execution Authority'));
      }
    }
  }
  return ok(true);
}

function validateBound(bound: AccessBound): Result<true, AccessFabricFailure> {
  if (!isAccessBoundKind(bound.kind)) {
    return err(failure('INVALID_BOUND', `Unknown bound kind: ${bound.kind}`));
  }
  switch (bound.kind) {
    case 'TIME':
      if (!isUtcInstant(bound.notBefore) || !isUtcInstant(bound.notAfter)) {
        return err(failure('INVALID_BOUND', 'TIME bound requires UTC instants'));
      }
      if (bound.notAfter <= bound.notBefore) {
        return err(failure('INVALID_BOUND', 'TIME bound notAfter must be after notBefore'));
      }
      return ok(true);
    case 'QUANTITY':
      if (!bound.unit.trim()) {
        return err(failure('INVALID_BOUND', 'QUANTITY bound requires a unit'));
      }
      if (bound.quantity <= 0n) {
        return err(failure('INVALID_BOUND', 'QUANTITY bound must be positive'));
      }
      return ok(true);
    case 'LOCATION':
      if (!bound.jurisdiction.trim() || !bound.placeRef.trim()) {
        return err(failure('INVALID_BOUND', 'LOCATION bound requires jurisdiction and placeRef'));
      }
      return ok(true);
    case 'USAGE':
      if (!bound.meter.trim()) {
        return err(failure('INVALID_BOUND', 'USAGE bound requires a meter'));
      }
      if (bound.allowance <= 0n) {
        return err(failure('INVALID_BOUND', 'USAGE bound allowance must be positive'));
      }
      return ok(true);
    default:
      return err(failure('INVALID_BOUND', `Unsupported bound kind: ${(bound as AccessBound).kind}`));
  }
}

export function validateAccessIntentInput(input: ProposeAccessIntentInput): Result<true, AccessFabricFailure> {
  const forbidden = scanForbiddenAccessPayload(input);
  if (!forbidden.ok) {
    return forbidden;
  }
  if (!isAccessIntentKind(input.kind)) {
    return err(failure('INVALID_CATEGORY', `Unknown intent kind: ${input.kind}`));
  }
  if (!isAccessCapacityCategory(input.category)) {
    return err(failure('INVALID_CATEGORY', `Unknown capacity category: ${input.category}`));
  }
  if (!input.bounds.length) {
    return err(failure('INVALID_BOUND', 'Access intent requires at least one bound'));
  }
  for (const bound of input.bounds) {
    const checked = validateBound(bound);
    if (!checked.ok) {
      return checked;
    }
  }
  return ok(true);
}

export function validateAccessRightInput(input: RegisterAccessRightInput): Result<true, AccessFabricFailure> {
  const forbidden = scanForbiddenAccessPayload(input);
  if (!forbidden.ok) {
    return forbidden;
  }
  if (input.state !== undefined && !isAccessRightState(input.state)) {
    return err(failure('STATE_CONFLICT', `Unknown access right state: ${input.state}`));
  }
  if (!isAccessCapacityCategory(input.category)) {
    return err(failure('INVALID_CATEGORY', `Unknown capacity category: ${input.category}`));
  }
  if (!input.bounds.length) {
    return err(failure('INVALID_BOUND', 'Access right requires at least one bound'));
  }
  for (const bound of input.bounds) {
    const checked = validateBound(bound);
    if (!checked.ok) {
      return checked;
    }
  }
  return ok(true);
}

export function accessFabricDoesNotMint(): true {
  return true;
}

export function accessFabricDoesNotSettle(): true {
  return true;
}

export function accessFabricRefusesAuthorityIssuance(): true {
  return true;
}
