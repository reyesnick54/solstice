/**
 * Kill switches, limited-live framework, and certification records.
 * Limited live is not activated. Unit tests are not external certification.
 */

import {
  universalErr,
  universalOk,
  type CertificationDistinction,
  type KillSwitchRecord,
  type KillSwitchScope,
  type LimitedLiveRule,
  type ProviderCertificationRecord,
  type ProviderEnvironment,
  type UniversalResult,
} from './types.ts';

export function createKillSwitch(input: {
  readonly switchId: string;
  readonly providerId: string;
  readonly scope: KillSwitchScope;
  readonly target: string;
  readonly actorId: string;
  readonly reason: string;
  readonly nowUtc: string;
  readonly allowReadOnlyReconciliation?: boolean;
}): KillSwitchRecord {
  return Object.freeze({
    switchId: input.switchId,
    providerId: input.providerId,
    scope: input.scope,
    target: input.target,
    active: true,
    allowReadOnlyReconciliation: input.allowReadOnlyReconciliation === true,
    actorId: input.actorId,
    reason: input.reason,
    createdAt: input.nowUtc,
    frontendExposed: false as const,
  });
}

export function deactivateKillSwitch(record: KillSwitchRecord, actorId: string, nowUtc: string): KillSwitchRecord {
  return Object.freeze({
    ...record,
    active: false,
    actorId,
    createdAt: nowUtc,
    frontendExposed: false as const,
  });
}

export function createLimitedLiveRule(input: {
  readonly ruleId: string;
  readonly providerId: string;
  readonly allowlistedCustomers?: readonly string[];
  readonly jurisdictions?: readonly string[];
  readonly currencies?: readonly string[];
  readonly maxTransactionMinor?: bigint | null;
  readonly dailyAggregateCapMinor?: bigint | null;
  readonly products?: readonly string[];
}): LimitedLiveRule {
  return Object.freeze({
    ruleId: input.ruleId,
    providerId: input.providerId,
    allowlistedCustomers: Object.freeze([...(input.allowlistedCustomers ?? [])]),
    jurisdictions: Object.freeze([...(input.jurisdictions ?? [])]),
    currencies: Object.freeze([...(input.currencies ?? [])]),
    maxTransactionMinor: input.maxTransactionMinor ?? null,
    dailyAggregateCapMinor: input.dailyAggregateCapMinor ?? null,
    products: Object.freeze([...(input.products ?? [])]),
    activated: false as const,
  });
}

export function evaluateLimitedLive(rule: LimitedLiveRule, input: {
  readonly customerId: string;
  readonly jurisdiction: string;
  readonly currency: string;
  readonly product: string;
  readonly amountMinor: bigint;
  readonly dailyAggregateMinor: bigint;
}): UniversalResult<false> {
  void input;
  void rule;
  return universalErr(
    'PROVIDER_LIFECYCLE_FORBIDDEN',
    'limited-live framework is present but not activated',
  );
}

export function recordCertification(input: {
  readonly certificationId: string;
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly environment: ProviderEnvironment;
  readonly testSuiteVersion: string;
  readonly testDateUtc: string;
  readonly result: 'PASS' | 'FAIL';
  readonly distinction: CertificationDistinction;
  readonly evidenceRefs?: readonly string[];
  readonly approvedBy?: string | null;
  readonly approvedAtUtc?: string | null;
  readonly expiresAtUtc?: string | null;
}): UniversalResult<ProviderCertificationRecord> {
  if (input.distinction === 'EXTERNAL_PROVIDER_CERTIFIED') {
    if (!input.approvedBy || !input.approvedAtUtc || (input.evidenceRefs ?? []).length === 0) {
      return universalErr(
        'PROVIDER_CERTIFICATION_INSUFFICIENT',
        'EXTERNAL_PROVIDER_CERTIFIED requires approval and external evidence; unit tests are not certification',
        { providerId: input.providerId },
      );
    }
  }
  if (input.distinction === 'INTERNAL_ADAPTER_TESTED' && input.result !== 'PASS') {
    return universalErr(
      'PROVIDER_CERTIFICATION_INSUFFICIENT',
      'INTERNAL_ADAPTER_TESTED requires a passing internal suite',
      { providerId: input.providerId },
    );
  }
  return universalOk(
    Object.freeze({
      certificationId: input.certificationId,
      providerId: input.providerId,
      adapterVersion: input.adapterVersion,
      environment: input.environment,
      testSuiteVersion: input.testSuiteVersion,
      testDateUtc: input.testDateUtc,
      result: input.result,
      distinction: input.distinction,
      evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
      approvedBy: input.approvedBy ?? null,
      approvedAtUtc: input.approvedAtUtc ?? null,
      expiresAtUtc: input.expiresAtUtc ?? null,
      unitTestsAreNotExternalCertification: true as const,
    }),
  );
}
