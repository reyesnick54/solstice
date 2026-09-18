import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../../../../config/src/flags.ts';
import {
  HELIOS_H31_ADVERSARIAL_RESILIENCE,
  HELIOS_RESILIENCE_BLOCKED,
  HELIOS_RESILIENCE_QUALIFIED,
  assessFaultInjectionGate,
  assertFaultInjectionAllowed,
  baselineResilienceInvariants,
  createFault,
  createFaultInjector,
  payloadContainsSecrets,
  redactSecrets,
  scenarioDefinition,
  scenariosForTier,
} from './index.ts';

describe('HELIOS H31 resilience module', () => {
  it('exports chunk marker HELIOS_H31_ADVERSARIAL_RESILIENCE', () => {
    assert.equal(HELIOS_H31_ADVERSARIAL_RESILIENCE, 'HELIOS_H31_ADVERSARIAL_RESILIENCE');
  });

  it('fault injection is blocked outside simulation or without opt-in flag', () => {
    const gate = assessFaultInjectionGate({ ...process.env, HELIOS_FAULT_INJECTION: undefined });
    if (ENVIRONMENT === 'simulation') {
      assert.equal(gate.allowed, false);
    }
    assert.throws(() => assertFaultInjectionAllowed({ ...process.env, HELIOS_FAULT_INJECTION: undefined }));
  });

  it('fault injector arms only when gate allows', () => {
    const injector = createFaultInjector();
    const prev = process.env.HELIOS_FAULT_INJECTION;
    process.env.HELIOS_FAULT_INJECTION = '1';
    try {
      if (ENVIRONMENT === 'simulation') {
        injector.arm(createFault('f1', 'TIMEOUT', 'grok', 'timeout'));
        assert.ok(injector.shouldFire('f1'));
      }
    } finally {
      if (prev === undefined) delete process.env.HELIOS_FAULT_INJECTION;
      else process.env.HELIOS_FAULT_INJECTION = prev;
    }
  });

  it('redacts secrets from error payloads', () => {
    const raw = 'provider failed Bearer sk-h31testsecret12345678901234567890';
    const redacted = redactSecrets(raw);
    assert.ok(!payloadContainsSecrets(redacted));
    assert.ok(redacted.includes('[REDACTED]'));
  });

  it('catalog defines fast and chaos tiers', () => {
    const fast = scenariosForTier('FAST_CI');
    const chaos = scenariosForTier('CHAOS_QUALIFICATION');
    assert.ok(fast.length > 0);
    assert.ok(chaos.length > 0);
    assert.ok(fast.every((row) => scenarioDefinition(row.testId).tier === 'FAST_CI'));
  });

  it('baseline invariants all held for safe defaults', () => {
    const results = baselineResilienceInvariants({
      noDuplicateMoneyMovement: true,
      noCrossUserLeakage: true,
      noUnknownAsAllowed: true,
      noProviderErrorAsSuccess: true,
      noFabricatedIntelligence: true,
      noUnauthorizedFallback: true,
      customerIsolationHeld: true,
      noNegativeCashFromRace: true,
      accountingBalanced: true,
      principalNotProfit: true,
      oneOperationOneEffect: true,
      noFinancialEffectWithoutAuthority: true,
      noPaperAsLive: true,
      noReportAsFiling: true,
      noStaleEvidenceAsCurrent: true,
    });
    assert.ok(results.every((row) => row.held));
  });

  it('qualification markers distinguish qualified vs blocked', () => {
    assert.equal(HELIOS_RESILIENCE_QUALIFIED, 'HELIOS_RESILIENCE_QUALIFIED');
    assert.equal(HELIOS_RESILIENCE_BLOCKED, 'HELIOS_RESILIENCE_BLOCKED');
  });
});
