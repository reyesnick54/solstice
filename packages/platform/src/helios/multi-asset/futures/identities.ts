/**
 * M03 — futures identity parsing and validation.
 */

import type {
  ExecutabilityClass,
  FuturesContinuousIdentity,
  FuturesContractIdentity,
  FuturesFamilyIdentity,
} from './types.ts';

const FAMILY_PREFIX = 'FUTURES_FAMILY:';
const CONTRACT_PREFIX = 'FUTURES:';
const CONTINUOUS_SUFFIX = ':CONTINUOUS';

export function futuresFamilyId(exchange: string, rootSymbol: string, family: string): string {
  return `${FAMILY_PREFIX}${exchange}:${rootSymbol}:${family}`;
}

export function futuresContractId(exchange: string, rootSymbol: string, family: string, contractMonth: string): string {
  return `${CONTRACT_PREFIX}${exchange}:${rootSymbol}:${family}:${contractMonth}`;
}

export function futuresContinuousId(exchange: string, rootSymbol: string, family: string): string {
  return `${CONTRACT_PREFIX}${exchange}:${rootSymbol}:${family}${CONTINUOUS_SUFFIX}`;
}

export function parseFuturesIdentity(instrumentId: string):
  | { readonly kind: 'futures_family'; readonly familyId: string }
  | { readonly kind: 'futures_contract'; readonly contractId: string; readonly contractMonth: string; readonly familyId: string }
  | { readonly kind: 'futures_continuous'; readonly continuousId: string; readonly familyId: string }
  | { readonly kind: 'unknown' } {
  if (instrumentId.startsWith(FAMILY_PREFIX)) {
    return Object.freeze({ kind: 'futures_family', familyId: instrumentId });
  }
  if (instrumentId.endsWith(CONTINUOUS_SUFFIX) && instrumentId.startsWith(CONTRACT_PREFIX)) {
    const withoutContinuous = instrumentId.slice(0, -CONTINUOUS_SUFFIX.length);
    const parts = withoutContinuous.split(':');
    if (parts.length >= 4) {
      const familyId = futuresFamilyId(parts[1]!, parts[2]!, parts[3]!);
      return Object.freeze({ kind: 'futures_continuous', continuousId: instrumentId, familyId });
    }
  }
  if (instrumentId.startsWith(CONTRACT_PREFIX)) {
    const parts = instrumentId.split(':');
    if (parts.length >= 5) {
      const contractMonth = parts[4]!;
      const familyId = futuresFamilyId(parts[1]!, parts[2]!, parts[3]!);
      return Object.freeze({ kind: 'futures_contract', contractId: instrumentId, contractMonth, familyId });
    }
  }
  return Object.freeze({ kind: 'unknown' });
}

export function executabilityForIdentity(instrumentId: string): ExecutabilityClass {
  const parsed = parseFuturesIdentity(instrumentId);
  if (parsed.kind === 'futures_continuous') {
    return 'RESEARCH_ONLY';
  }
  if (parsed.kind === 'futures_contract') {
    return 'EXECUTABLE';
  }
  if (parsed.kind === 'futures_family') {
    return 'NON_EXECUTABLE';
  }
  return 'NON_EXECUTABLE';
}

export function isExecutableFuturesContract(instrumentId: string): boolean {
  return executabilityForIdentity(instrumentId) === 'EXECUTABLE';
}

export function assertExecutableForExecution(instrumentId: string):
  | { readonly ok: true; readonly contractId: string }
  | { readonly ok: false; readonly code: string; readonly message: string } {
  const parsed = parseFuturesIdentity(instrumentId);
  if (parsed.kind === 'futures_continuous') {
    return Object.freeze({
      ok: false,
      code: 'CONTINUOUS_SERIES_NON_EXECUTABLE',
      message: 'synthetic continuous futures series cannot receive Execution Authority',
    });
  }
  if (parsed.kind === 'futures_family') {
    return Object.freeze({
      ok: false,
      code: 'FAMILY_NOT_EXECUTABLE',
      message: 'futures family identity must resolve to a specific contract for execution',
    });
  }
  if (parsed.kind === 'futures_contract') {
    return Object.freeze({ ok: true, contractId: parsed.contractId });
  }
  return Object.freeze({
    ok: false,
    code: 'UNKNOWN_FUTURES_IDENTITY',
    message: 'instrument is not a recognized futures identity',
  });
}

export function buildFuturesFamily(input: {
  readonly exchange: string;
  readonly rootSymbol: string;
  readonly family: string;
  readonly displayName: string;
  readonly currency: string;
  readonly unit: string;
}): FuturesFamilyIdentity {
  return Object.freeze({
    kind: 'futures_family',
    familyId: futuresFamilyId(input.exchange, input.rootSymbol, input.family),
    exchange: input.exchange,
    rootSymbol: input.rootSymbol,
    displayName: input.displayName,
    currency: input.currency,
    unit: input.unit,
  });
}

export function buildFuturesContinuous(input: {
  readonly exchange: string;
  readonly rootSymbol: string;
  readonly family: string;
  readonly rollMethod?: 'front_month' | 'volume_weighted';
}): FuturesContinuousIdentity {
  const familyId = futuresFamilyId(input.exchange, input.rootSymbol, input.family);
  return Object.freeze({
    kind: 'futures_continuous',
    continuousId: futuresContinuousId(input.exchange, input.rootSymbol, input.family),
    familyId,
    rollMethod: input.rollMethod ?? 'front_month',
    executability: 'RESEARCH_ONLY',
  });
}

export function buildFuturesContract(input: {
  readonly exchange: string;
  readonly rootSymbol: string;
  readonly family: string;
  readonly contractMonth: string;
  readonly metadata: FuturesContractIdentity['metadata'];
}): FuturesContractIdentity {
  const familyId = futuresFamilyId(input.exchange, input.rootSymbol, input.family);
  return Object.freeze({
    kind: 'futures_contract',
    contractId: futuresContractId(input.exchange, input.rootSymbol, input.family, input.contractMonth),
    familyId,
    contractMonth: input.contractMonth,
    metadata: input.metadata,
    executability: 'EXECUTABLE',
  });
}
