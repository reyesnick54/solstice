import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { staffOperatorFromRoles } from '../../../identity/src/staff/operator.ts';
import {
  assertAuditorCannotMutate,
  auditorCatalogFromReceipts,
  AUDITOR_READ_ONLY_SCOPE,
  evaluateAuditorAccess,
} from './auditor.ts';
import { buildJurisdictionContext, jurisdictionSignal } from './jurisdiction-context.ts';
import { createLegalHold, isDeletionBlockedByLegalHold, LegalHoldRegistry } from './legal-hold.ts';
import { RegulatoryFeatureGateRegistry } from './feature-gates.ts';
import { ProviderLicenseRegistry } from './provider-license.ts';
import { DataResidencyRegistry } from './residency.ts';
import { RetentionPolicyRegistry } from './retention.ts';
import { createRegulatoryControlEngine } from './engine.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const PAST = asUtcInstant('2025-01-01T00:00:00.000Z');
const OLD = asUtcInstant('2020-01-01T00:00:00.000Z');

function gbContext() {
  return buildJurisdictionContext({
    effectiveFrom: NOW,
    signals: [
      jurisdictionSignal('USER', 'GB', 'customer:gb'),
      jurisdictionSignal('ENTITY', 'GB', 'legal-entity:gb'),
      jurisdictionSignal('SERVICE', 'GB', 'service:gb'),
    ],
  });
}

function saContext() {
  return buildJurisdictionContext({
    effectiveFrom: NOW,
    signals: [
      jurisdictionSignal('USER', 'SA', 'customer:sa'),
      jurisdictionSignal('ENTITY', 'SA', 'legal-entity:sa'),
      jurisdictionSignal('SERVICE', 'SA', 'service:sa'),
    ],
  });
}

function usContext() {
  return buildJurisdictionContext({
    effectiveFrom: NOW,
    signals: [
      jurisdictionSignal('USER', 'US', 'customer:us'),
      jurisdictionSignal('ENTITY', 'US', 'legal-entity:us'),
      jurisdictionSignal('SERVICE', 'US', 'service:us'),
    ],
  });
}

describe('Wave 7 regulatory controls', () => {
  it('allows same action in sandbox but denies in restricted production jurisdiction', () => {
    const engine = createRegulatoryControlEngine();
    const sandbox = engine.evaluate({
      action: 'EXCHANGE_TRADE',
      jurisdictionContext: usContext(),
      regulatedFeature: 'EXCHANGE',
      environment: 'sandbox',
      at: NOW,
    });
    assert.equal(sandbox.outcome, 'ALLOW');

    const production = engine.evaluate({
      action: 'EXCHANGE_TRADE',
      jurisdictionContext: usContext(),
      regulatedFeature: 'EXCHANGE',
      environment: 'production',
      at: NOW,
    });
    assert.equal(production.outcome, 'DENY');
    assert.equal(production.reasonCode, 'FEATURE_GATE_SANDBOX_DENIED_IN_PRODUCTION');
  });

  it('denies provider persist when license allows query only', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'ORACLE_FETCH',
      jurisdictionContext: gbContext(),
      providerId: 'fixture-oracle-alpha',
      providerCapability: 'PERSIST',
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.blockedBy, 'PROVIDER_LICENSE');
    assert.match(result.reason, /denies capability PERSIST/);
  });

  it('allows provider query when persist is denied', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'ORACLE_FETCH',
      jurisdictionContext: gbContext(),
      providerId: 'fixture-oracle-alpha',
      providerCapability: 'QUERY',
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'ALLOW');
  });

  it('denies cross-border storage restriction violation', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'STORE_PERSONAL_DATA',
      jurisdictionContext: buildJurisdictionContext({
        effectiveFrom: NOW,
        signals: [
          jurisdictionSignal('USER', 'EU', 'customer:de'),
          jurisdictionSignal('DATA_STORAGE', 'EU', 'storage:de'),
        ],
      }),
      storageRegion: 'US_EAST',
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.blockedBy, 'RESIDENCY');
    assert.match(result.reason, /prohibited/);
  });

  it('marks expired retention record as deletable', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluateRetention({
      category: 'LOGS',
      recordCreatedAt: OLD,
      at: NOW,
    });
    assert.equal(result.expired, true);
    assert.equal(result.deletable, true);
    assert.equal(result.immutable, false);
  });

  it('protects financial history from destructive deletion', () => {
    const engine = createRegulatoryControlEngine();
    for (const category of ['LEDGER_RECORDS', 'EVIDENCE_VAULT', 'TRANSACTION_RECORDS'] as const) {
      const result = engine.evaluateRetention({
        category,
        recordCreatedAt: OLD,
        at: NOW,
      });
      assert.equal(result.immutable, true);
      assert.equal(result.deletable, false);
      assert.equal(result.reasonCode, 'RETENTION_IMMUTABLE');
    }
  });

  it('keeps auditor read-only without mutation authority', () => {
    const auditor = staffOperatorFromRoles({
      operatorId: 'aud_1',
      identityId: 'id_aud_1',
      roles: ['AUDITOR'],
      assurance: 'STRONG',
      stepUpSatisfied: true,
      sessionId: 'sess_aud_1',
    });
    assert.throws(() => assertAuditorCannotMutate('POST_JOURNAL'), /auditor cannot perform monetary mutation/);
    assert.throws(() => assertAuditorCannotMutate('ISSUE_EXECUTION_AUTHORITY'), /auditor cannot perform monetary mutation/);

    const access = evaluateAuditorAccess(
      {
        operatorId: auditor.operatorId,
        role: 'AUDITOR',
        scope: AUDITOR_READ_ONLY_SCOPE,
        at: NOW,
      },
      auditorCatalogFromReceipts([], NOW),
    );
    assert.equal(access.permitted, true);
    assert.equal(access.readOnly, true);
  });

  it('disables regulated feature in restricted jurisdiction', () => {
    const gates = new RegulatoryFeatureGateRegistry();
    const result = gates.evaluate({
      feature: 'HEALTH_DATA_CONTRIBUTION',
      jurisdiction: 'US',
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.mode, 'DISABLED');
  });

  it('denies when rights allowed but jurisdiction denied via feature gate', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'HEALTH_CONTRIBUTE',
      jurisdictionContext: usContext(),
      regulatedFeature: 'HEALTH_DATA_CONTRIBUTION',
      rightsGranted: true,
      consentGranted: true,
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.blockedBy, 'SERVICE_FEATURE_GATE');
  });

  it('denies when jurisdiction allowed but provider license denied', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'ORACLE_REDISTRIBUTE',
      jurisdictionContext: gbContext(),
      providerId: 'open-sanctions',
      providerCapability: 'REDISTRIBUTE',
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.blockedBy, 'PROVIDER_LICENSE');
  });

  it('defers on ambiguous jurisdiction context', () => {
    const engine = createRegulatoryControlEngine();
    const ambiguous = buildJurisdictionContext({
      effectiveFrom: NOW,
      signals: [
        jurisdictionSignal('USER', 'GB', 'customer:gb'),
        jurisdictionSignal('DATA_STORAGE', 'US', 'storage:us'),
      ],
    });
    const result = engine.evaluate({
      action: 'TRANSFER',
      jurisdictionContext: ambiguous,
      environment: 'simulation',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.reasonCode, 'JURISDICTION_CONTEXT_AMBIGUOUS');
  });

  it('blocks deletion under active legal hold', () => {
    const holds = new LegalHoldRegistry();
    holds.place({
      authorityRef: 'authority:case-2026-001',
      subjectRef: 'subject:cust_1',
      recordCategories: ['PERSONAL_DATA'],
      effectiveFrom: NOW,
    });
    assert.equal(isDeletionBlockedByLegalHold('PERSONAL_DATA', holds.active()), true);

    const retention = new RetentionPolicyRegistry();
    const result = retention.evaluate({
      category: 'PERSONAL_DATA',
      recordCreatedAt: OLD,
      at: NOW,
      activeLegalHolds: holds.active(),
    });
    assert.equal(result.deletable, false);
    assert.equal(result.blockedByLegalHold, true);
  });

  it('records compliance audit receipts for decisions', () => {
    const engine = createRegulatoryControlEngine();
    engine.evaluate({
      action: 'BANKING_TRANSFER',
      jurisdictionContext: gbContext(),
      regulatedFeature: 'BANKING_TRANSFER',
      environment: 'simulation',
      at: NOW,
    });
    assert.ok(engine.receiptStore().count() > 0);
    assert.ok(engine.receiptStore().byKind('JURISDICTION').length > 0);
    assert.ok(engine.receiptStore().byKind('DECISION').length > 0);
  });

  it('denies exchange in SA restricted production jurisdiction', () => {
    const engine = createRegulatoryControlEngine();
    const result = engine.evaluate({
      action: 'EXCHANGE_TRADE',
      jurisdictionContext: saContext(),
      regulatedFeature: 'EXCHANGE',
      environment: 'production',
      at: NOW,
    });
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.reasonCode, 'FEATURE_GATE_DISABLED');
  });

  it('evaluates provider license registry independently', () => {
    const licenses = new ProviderLicenseRegistry();
    const persist = licenses.evaluate({
      providerId: 'fixture-health-provider',
      capability: 'PERSIST',
      jurisdiction: 'US',
      at: NOW,
    });
    assert.equal(persist.allowed, false);

    const query = licenses.evaluate({
      providerId: 'fixture-health-provider',
      capability: 'QUERY',
      jurisdiction: 'US',
      at: NOW,
    });
    assert.equal(query.allowed, true);
  });

  it('evaluates residency processing-only constraint', () => {
    const residency = new DataResidencyRegistry();
    const result = residency.evaluate({
      jurisdiction: 'XA',
      storageRegion: 'PROCESSING_ONLY',
      persist: true,
      at: NOW,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'RESIDENCY_PROCESSING_ONLY');
  });

  it('creates and releases legal hold records', () => {
    const hold = createLegalHold({
      authorityRef: 'authority:legal-001',
      subjectRef: 'subject:acct_1',
      recordCategories: ['CONSENT_RECORDS'],
      effectiveFrom: PAST,
    });
    assert.equal(hold.active, true);
    assert.equal(hold.legalStatus, 'RESEARCH_REQUIRED');
  });
});
