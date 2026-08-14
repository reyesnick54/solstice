import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../../domain/src/account.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
} from '../../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity } from '../../../domain/src/legal-entity.ts';
import { asProductId, freezeProduct } from '../../../domain/src/product.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { isOk } from '../../../domain/src/result.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { Money } from '../../../money/src/money.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { combineProofs } from '../../../permissions/src/decision.ts';
import { ComplianceKernel } from '../kernel.ts';
import { createSimulationPolicyEngine } from './create.ts';
import { PolicyEngine } from './engine.ts';
import { diffPolicyVersions } from './diff.ts';
import { runPolicyScenarios } from './harness.ts';
import { loadBundledPacks } from './packs/load.ts';
import { contentHashForRules, PolicyRegistry } from './registry.ts';
import { POLICY_PRODUCT_BINDINGS, SIMULATION_CAPABILITIES } from './seed.ts';
import type { PolicyVersionRecord } from './types.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

const GB_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

const US_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_us_inc'),
  name: 'Solstice US Inc (simulation)',
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

const SA_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_sa_entity'),
  name: 'Solstice SA Entity (simulation)',
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

const GB_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_usd_gb'),
  name: 'GB demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: GB_ENTITY.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

const US_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_usd_us'),
  name: 'US demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: US_ENTITY.id,
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

const SA_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_sar_sa'),
  name: 'SA demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('SAR'),
  legalEntityId: SA_ENTITY.id,
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

function verifiedCustomer(id: string, jurisdiction: 'GB' | 'US' | 'SA' | 'JP', entityId: string): Customer {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId(entityId),
    jurisdiction: asJurisdiction(jurisdiction),
    residency: asResidency(jurisdiction),
    verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
  assert.equal(isOk(pending), true);
  if (!isOk(pending)) {
    throw new Error('pending');
  }
  customer = {
    ...pending.value.customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(customer, 'ACTIVE', NOW);
  assert.equal(isOk(active), true);
  if (!isOk(active)) {
    throw new Error('active');
  }
  return active.value.customer;
}

function openIntent(id: string, ownerId: string, productId: string, jurisdiction: 'GB' | 'US' | 'SA' | 'AE' | 'JP', entityId: string) {
  return {
    id: asIntentId(id),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: id,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_ONBOARDING' as const,
    payload: {
      accountId: id,
      ownerId,
      productId,
      accountClass: 'DEMAND_DEPOSIT' as const,
      legalEntityId: entityId,
      jurisdiction,
      currency: 'USD',
    },
  };
}

function factsFor(
  customer: Customer,
  product: typeof GB_PRODUCT,
  entity: typeof GB_ENTITY,
) {
  return {
    actor: { id: 'operator_1', capabilities: [ACTION_TYPES.OPEN_ACCOUNT] },
    customer,
    product,
    legalEntity: entity,
    jurisdiction: customer.jurisdiction,
    identity: {
      identityExists: true,
      identityStatus: 'ACTIVE' as const,
      subjectId: 'idn_policy_test',
      actorId: 'operator_1',
      actorSubjectMatch: true,
      authenticated: true,
      sessionValid: true,
      authenticationAssurance: 'STRONG' as const,
      kycState: customer.verification.kycState,
      kycLevel: 'STANDARD' as const,
      kycFresh: customer.verification.kycState === 'VERIFIED',
      kycVersion: customer.verification.kycRecordVersion,
      customerId: customer.id,
      authorizedCapabilities: ['ACCOUNT_OPEN_REQUEST'] as const,
    },
    policyIdentity: {
      kycState: customer.verification.kycState,
      kycRecordVersion: customer.verification.kycRecordVersion,
      residency: customer.residency,
    },
  };
}

describe('jurisdiction policy engine', () => {
  it('loads US/GB/EU/SA/AE pack shells and refuses CONFIRMED_BY_COUNSEL', () => {
    const packs = loadBundledPacks();
    assert.deepEqual(
      packs.map((pack) => pack.packId).sort(),
      ['AE', 'EU', 'GB', 'SA', 'US'],
    );
    for (const pack of packs) {
      for (const version of pack.versions) {
        assert.notEqual(version.legalReviewStatus, 'CONFIRMED_BY_COUNSEL');
        for (const rule of version.rules) {
          assert.notEqual(rule.legalReviewStatus, 'CONFIRMED_BY_COUNSEL');
        }
      }
    }
  });

  it('is deterministic for the same facts and version', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_det', 'GB', GB_ENTITY.id);
    const intent = openIntent('open_det', customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id);
    const facts = factsFor(customer, GB_PRODUCT, GB_ENTITY);
    const first = engine.evaluate(intent, facts, NOW);
    const second = engine.evaluate(intent, facts, NOW);
    assert.equal(first.decision, 'ALLOW');
    assert.equal(second.decision, first.decision);
    assert.deepEqual(second.reasonCodes, first.reasonCodes);
    assert.equal(second.snapshot.factsHash, first.snapshot.factsHash);
    assert.equal(second.snapshot.packHash, first.snapshot.packHash);
    assert.deepEqual(second.snapshot.evaluatedRuleIds, first.snapshot.evaluatedRuleIds);
  });

  it('fails closed when the jurisdiction pack is missing', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_jp', 'JP', GB_ENTITY.id);
    const result = engine.evaluate(
      openIntent('open_jp', customer.id, GB_PRODUCT.id, 'JP', GB_ENTITY.id),
      factsFor(customer, GB_PRODUCT, GB_ENTITY),
      NOW,
    );
    assert.ok(result.decision === 'DEFER' || result.decision === 'BLOCK' || result.decision === 'REQUIRE_MANUAL_REVIEW');
    assert.notEqual(result.decision, 'ALLOW');
    assert.ok(
      result.reasonCodes.includes('JURISDICTION_UNRESOLVED') ||
        result.reasonCodes.includes('JURISDICTION_AMBIGUOUS') ||
        result.reasonCodes.includes('POLICY_PACK_MISSING'),
    );
  });

  it('defers when a required KYC fact is missing', () => {
    const engine = createSimulationPolicyEngine();
    const customer = {
      ...verifiedCustomer('cust_kyc', 'GB', GB_ENTITY.id),
      verification: Object.freeze({
        kycState: 'IN_PROGRESS' as const,
        kycRecordVersion: 0,
        refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
      }),
    };
    const result = engine.evaluate(
      openIntent('open_kyc', customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id),
      factsFor(customer, GB_PRODUCT, GB_ENTITY),
      NOW,
    );
    assert.ok(result.decision === 'DEFER' || result.decision === 'REQUIRE_MANUAL_REVIEW');
    assert.ok(result.reasonCodes.includes('KYC_FACT_INCOMPLETE') || result.reasonCodes.includes('REQUIRED_FACT_MISSING'));
  });

  it('does not allow an unsupported product', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_prod', 'GB', GB_ENTITY.id);
    const unknown = freezeProduct({
      id: asProductId('prod_unknown'),
      name: 'unknown',
      accountClass: 'DEMAND_DEPOSIT',
      currency: asCurrencyCode('USD'),
      legalEntityId: GB_ENTITY.id,
      jurisdiction: asJurisdiction('GB'),
      status: 'ACTIVE',
    });
    const result = engine.evaluate(
      openIntent('open_unknown', customer.id, unknown.id, 'GB', GB_ENTITY.id),
      factsFor(customer, unknown, GB_ENTITY),
      NOW,
    );
    assert.notEqual(result.decision, 'ALLOW');
    assert.ok(result.reasonCodes.includes('PRODUCT_UNSUPPORTED') || result.reasonCodes.includes('PRODUCT_CAPABILITY_MISSING'));
  });

  it('blocks or defers a disabled legal-entity capability', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_sa', 'SA', SA_ENTITY.id);
    const result = engine.evaluate(
      openIntent('open_sa', customer.id, SA_PRODUCT.id, 'SA', SA_ENTITY.id),
      factsFor(customer, SA_PRODUCT, SA_ENTITY),
      NOW,
    );
    assert.ok(result.decision === 'BLOCK' || result.decision === 'DEFER');
    assert.ok(result.reasonCodes.includes('LEGAL_ENTITY_CAPABILITY_DISABLED'));
  });

  it('resolves the effective policy version at a UTC boundary', () => {
    const registry = new PolicyRegistry();
    registry.hydrate({
      packs: loadBundledPacks(),
      capabilities: SIMULATION_CAPABILITIES,
      products: POLICY_PRODUCT_BINDINGS,
    });
    const current = registry.getVersion('gb-sim-v1');
    assert.ok(current);
    const v2Rules = current.rules.map((rule) => ({
      ...rule,
      ruleId: 'gb-sim-shell-v2',
      version: '2',
      effect: 'REQUIRE_MANUAL_REVIEW' as const,
      reasonCode: 'POLICY_RULE_MATCHED',
    }));
    const draft: Omit<PolicyVersionRecord, 'contentHash'> = {
      versionId: 'gb-sim-v2',
      packId: 'GB',
      version: '2',
      lifecycle: 'ACTIVE_SIMULATION',
      legalReviewStatus: 'RESEARCH_REQUIRED',
      effectiveFrom: asUtcInstant('2026-10-01T00:00:00.000Z'),
      rules: v2Rules,
    };
    registry.putVersion({ ...draft, contentHash: contentHashForRules(draft) });
    const engine = new PolicyEngine({ registry });
    const customer = verifiedCustomer('cust_ver', 'GB', GB_ENTITY.id);
    const intent = openIntent('open_ver', customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id);
    const facts = factsFor(customer, GB_PRODUCT, GB_ENTITY);
    const before = engine.evaluate(intent, facts, asUtcInstant('2026-09-30T23:59:59.000Z'));
    const on = engine.evaluate(intent, facts, asUtcInstant('2026-10-01T00:00:00.000Z'));
    assert.equal(before.snapshot.versionId, 'gb-sim-v1');
    assert.equal(before.decision, 'ALLOW');
    assert.equal(on.snapshot.versionId, 'gb-sim-v2');
    assert.equal(on.decision, 'REQUIRE_MANUAL_REVIEW');
  });

  it('reproduces a historical decision from a pinned version after a newer version is active', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_hist', 'GB', GB_ENTITY.id);
    const intent = openIntent('open_hist', customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id);
    const facts = factsFor(customer, GB_PRODUCT, GB_ENTITY);
    const original = engine.evaluate(intent, facts, NOW);
    const current = engine.registry.getVersion('gb-sim-v1');
    assert.ok(current);
    const draft: Omit<PolicyVersionRecord, 'contentHash'> = {
      versionId: 'gb-sim-v2-hist',
      packId: 'GB',
      version: '2-hist',
      lifecycle: 'ACTIVE_SIMULATION',
      legalReviewStatus: 'RESEARCH_REQUIRED',
      effectiveFrom: NOW,
      rules: current.rules,
    };
    engine.registry.putVersion({ ...draft, contentHash: contentHashForRules(draft) });
    const replay = engine.evaluate(intent, {
      ...facts,
      policyPin: { packId: 'GB', versionId: original.snapshot.versionId! },
    }, NOW);
    assert.equal(replay.decision, original.decision);
    assert.equal(replay.snapshot.packHash, original.snapshot.packHash);
    assert.deepEqual(replay.reasonCodes, original.reasonCodes);
  });

  it('preserves monotonic Kernel escalation when policy requires review', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const kernel = new ComplianceKernel(
      new AuthorityIssuer('solstice-simulation-ea-hmac-v1'),
      evidence,
      clock,
    );
    const customer = createProspect({
      id: asCustomerId('cust_review'),
      legalEntityId: GB_ENTITY.id,
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
    assert.equal(isOk(pending), true);
    if (!isOk(pending)) {
      return;
    }
    const decision = kernel.submit(
      openIntent('open_review', pending.value.customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id),
      factsFor(pending.value.customer, GB_PRODUCT, GB_ENTITY),
    );
    assert.notEqual(decision.status, 'ALLOW');
    assert.equal(decision.status, combineProofs(decision.proofs));
    const identity = decision.proofs.find((proof) => proof.proof === 'IDENTITY');
    const compliance = decision.proofs.find((proof) => proof.proof === 'COMPLIANCE');
    assert.equal(identity?.status, 'ALLOW');
    assert.equal(compliance?.status, 'REQUIRE_MANUAL_REVIEW');
    assert.ok(decision.executionAuthority === null);
  });

  it('creates a manual-review case and refuses AI approval and HARD_BLOCK override', () => {
    const engine = createSimulationPolicyEngine();
    const customer = createProspect({
      id: asCustomerId('cust_case'),
      legalEntityId: GB_ENTITY.id,
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
    assert.equal(isOk(pending), true);
    if (!isOk(pending)) {
      return;
    }
    const result = engine.evaluate(
      openIntent('open_case', pending.value.customer.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id),
      factsFor(pending.value.customer, GB_PRODUCT, GB_ENTITY),
      NOW,
    );
    assert.equal(result.decision, 'REQUIRE_MANUAL_REVIEW');
    assert.ok(result.snapshot.reviewId);
    const review = engine.reviews.get(result.snapshot.reviewId!);
    assert.ok(review);
    assert.equal(review.status, 'OPEN');

    const ai = engine.decideReview({
      reviewId: review.reviewId,
      status: 'APPROVED',
      decidedAt: NOW,
      decidedBy: { kind: 'AI', actorId: 'agent' },
    });
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.reasonCode, 'REVIEW_REQUIRES_HUMAN_OPERATOR');
    }

    const hard = engine.reviews.open({
      reasonCodes: ['LEGAL_ENTITY_CAPABILITY_DISABLED'],
      snapshot: result.snapshot,
      factsHash: result.snapshot.factsHash,
      overrideClass: 'HARD_BLOCK',
      createdAt: NOW,
    });
    const forced = engine.decideReview({
      reviewId: hard.reviewId,
      status: 'APPROVED',
      decidedAt: NOW,
      decidedBy: { kind: 'HUMAN_OPERATOR', actorId: 'operator_1' },
    });
    assert.equal(forced.ok, false);
    if (!forced.ok) {
      assert.equal(forced.reasonCode, 'HARD_BLOCK_NOT_OVERRIDABLE');
    }
  });

  it('records policy events without raw identity data', () => {
    const events = new DomainEventLog();
    const engine = createSimulationPolicyEngine({
      record(event) {
        if (event.eventType === 'PolicyPackActivated') {
          events.append({
            eventType: 'PolicyPackActivated',
            schemaVersion: 1,
            occurredAt: asUtcInstant(event.occurredAt),
            payload: {
              packId: event.payload.packId ?? '',
              versionId: event.payload.versionId ?? '',
              packHash: event.payload.packHash ?? '',
              lifecycle: event.payload.lifecycle ?? '',
            },
          });
          return;
        }
        events.append({
          eventType: 'PolicyPackRetired',
          schemaVersion: 1,
          occurredAt: asUtcInstant(event.occurredAt),
          payload: {
            packId: event.payload.packId ?? '',
            versionId: event.payload.versionId ?? '',
            packHash: event.payload.packHash ?? '',
            lifecycle: event.payload.lifecycle ?? '',
          },
        });
      },
    });
    engine.retirePack('SA', 'sa-sim-v1', NOW);
    engine.activatePack('US', 'us-sim-v1', NOW);
    const types = events.list().map((event) => event.eventType);
    assert.ok(types.includes('PolicyPackRetired'));
    assert.ok(types.includes('PolicyPackActivated'));
    for (const event of events.list()) {
      const payload = JSON.stringify(event.payload);
      assert.equal(payload.includes('ssn'), false);
      assert.equal(payload.includes('kycDocument'), false);
    }
  });

  it('seals evidence that references the exact policy version', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const kernel = new ComplianceKernel(
      new AuthorityIssuer('solstice-simulation-ea-hmac-v1'),
      evidence,
      clock,
    );
    const customer = verifiedCustomer('cust_ev', 'US', US_ENTITY.id);
    const decision = kernel.submit(
      openIntent('open_ev', customer.id, US_PRODUCT.id, 'US', US_ENTITY.id),
      factsFor(customer, US_PRODUCT, US_ENTITY),
    );
    assert.equal(decision.status, 'ALLOW');
    assert.ok(decision.policySnapshot);
    const record = evidence.list().find((row) => row.kind === 'KERNEL_DECISION');
    assert.ok(record);
    const payload = record.payload as { policy: { packId: string; versionId: string; factsHash: string } };
    assert.equal(payload.policy.packId, 'US');
    assert.equal(payload.policy.versionId, 'us-sim-v1');
    assert.equal(payload.policy.factsHash, decision.policySnapshot?.factsHash);
    evidence.verifyChain();
  });

  it('feeds identity KYC facts into policy evaluation', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_id', 'US', US_ENTITY.id);
    const result = engine.evaluate(
      openIntent('open_id', customer.id, US_PRODUCT.id, 'US', US_ENTITY.id),
      {
        ...factsFor(customer, US_PRODUCT, US_ENTITY),
        policyIdentity: {
          kycState: 'VERIFIED',
          kycRecordVersion: 1,
          residency: asResidency('US'),
        },
      },
      NOW,
    );
    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.snapshot.legalConfidence, 'RESEARCH_REQUIRED');
  });

  it('runs the table-driven scenario harness', () => {
    const engine = createSimulationPolicyEngine();
    const us = verifiedCustomer('cust_sc_us', 'US', US_ENTITY.id);
    const gb = verifiedCustomer('cust_sc_gb', 'GB', GB_ENTITY.id);
    const results = runPolicyScenarios(engine, [
      {
        name: 'US simulated verified customer OPEN_ACCOUNT',
        intent: openIntent('sc_us', us.id, US_PRODUCT.id, 'US', US_ENTITY.id),
        facts: factsFor(us, US_PRODUCT, US_ENTITY),
        at: NOW,
        expected: 'ALLOW',
      },
      {
        name: 'GB simulated verified customer OPEN_ACCOUNT',
        intent: openIntent('sc_gb', gb.id, GB_PRODUCT.id, 'GB', GB_ENTITY.id),
        facts: factsFor(gb, GB_PRODUCT, GB_ENTITY),
        at: NOW,
        expected: 'ALLOW',
      },
    ]);
    assert.equal(results.every((row) => row.passed), true);
  });

  it('diffs two policy versions', () => {
    const v1 = loadBundledPacks().find((pack) => pack.packId === 'GB')!.versions[0]!;
    const v2: PolicyVersionRecord = {
      ...v1,
      versionId: 'gb-diff-v2',
      version: '2',
      rules: [
        ...v1.rules,
        {
          ...v1.rules[0]!,
          ruleId: 'gb-added',
          effect: 'BLOCK',
          scope: 'hard-stop',
          legalReviewStatus: 'DRAFT',
          effectiveFrom: asUtcInstant('2026-10-01T00:00:00.000Z'),
        },
      ],
    };
    const diff = diffPolicyVersions(v1, v2);
    assert.deepEqual(diff.rulesAdded, ['gb-added']);
    assert.deepEqual(diff.rulesRemoved, []);
  });

  it('fails closed when the only version is not yet effective', () => {
    const registry = new PolicyRegistry();
    const pack = loadBundledPacks().find((row) => row.packId === 'AE')!;
    const future: PolicyVersionRecord = {
      ...pack.versions[0]!,
      versionId: 'ae-future',
      effectiveFrom: asUtcInstant('2028-01-01T00:00:00.000Z'),
    };
    registry.hydrate({
      packs: [{ ...pack, versions: [future] }],
      capabilities: SIMULATION_CAPABILITIES,
      products: POLICY_PRODUCT_BINDINGS,
    });
    const engine = new PolicyEngine({ registry });
    const customer = verifiedCustomer('cust_ae', 'SA', SA_ENTITY.id);
    const aeCustomer = {
      ...customer,
      jurisdiction: asJurisdiction('AE'),
      residency: asResidency('AE'),
      legalEntityId: asLegalEntityId('le_solstice_ae_entity'),
    };
    const aeEntity = freezeLegalEntity({
      id: asLegalEntityId('le_solstice_ae_entity'),
      name: 'AE',
      jurisdiction: asJurisdiction('AE'),
      status: 'ACTIVE',
    });
    const aeProduct = freezeProduct({
      id: asProductId('prod_demand_aed_ae'),
      name: 'AE demand',
      accountClass: 'DEMAND_DEPOSIT',
      currency: asCurrencyCode('AED'),
      legalEntityId: aeEntity.id,
      jurisdiction: asJurisdiction('AE'),
      status: 'ACTIVE',
    });
    const result = engine.evaluate(
      openIntent('open_ae', aeCustomer.id, aeProduct.id, 'AE', aeEntity.id),
      factsFor(aeCustomer, aeProduct, aeEntity),
      NOW,
    );
    assert.notEqual(result.decision, 'ALLOW');
    assert.ok(
      result.reasonCodes.includes('POLICY_VERSION_NOT_EFFECTIVE') ||
        result.reasonCodes.includes('LEGAL_ENTITY_CAPABILITY_DISABLED'),
    );
  });

  it('reloads an in-memory registry snapshot with the same version hash', () => {
    const first = createSimulationPolicyEngine();
    const snapshot = first.registry.snapshot();
    const second = new PolicyEngine();
    second.registry.hydrate(snapshot);
    assert.equal(second.registry.getVersion('us-sim-v1')?.contentHash, first.registry.getVersion('us-sim-v1')?.contentHash);
    assert.equal(second.registry.getCapability('cap-us-sim-deposit-banking')?.enabled, true);
    assert.equal(second.registry.getCapability('cap-sa-sim-deposit-banking')?.enabled, false);
  });

  it('resolves product and legal-entity refs from the source account', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_acct_refs', 'GB', GB_ENTITY.id);
    const result = engine.evaluate(
      {
        id: asIntentId('dep_refs'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'dep_refs',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: { accountId: 'acct_refs', amount: Money.fromMinorUnits(1_000n, 'USD') },
      },
      {
        actor: { id: 'operator_1', capabilities: [ACTION_TYPES.POST_DEPOSIT] },
        customer,
        jurisdiction: asJurisdiction('GB'),
        amount: Money.fromMinorUnits(1_000n, 'USD'),
        sourceAccount: {
          id: asAccountId('acct_refs'),
          ownerId: customer.id,
          accountClass: 'DEMAND_DEPOSIT',
          productId: GB_PRODUCT.id,
          legalEntityId: GB_ENTITY.id,
          jurisdiction: asJurisdiction('GB'),
          currency: asCurrencyCode('USD'),
          status: 'OPEN',
          openedAt: NOW,
          version: 0,
        },
        policyIdentity: {
          kycState: customer.verification.kycState,
          kycRecordVersion: customer.verification.kycRecordVersion,
          residency: customer.residency,
        },
      },
      NOW,
    );
    assert.equal(result.decision, 'ALLOW');
  });

  it('does not treat a deposit amount as growth and still evaluates policy', () => {
    const engine = createSimulationPolicyEngine();
    const customer = verifiedCustomer('cust_dep', 'GB', GB_ENTITY.id);
    const result = engine.evaluate(
      {
        id: asIntentId('dep_1'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'dep_1',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: { accountId: 'acct_1', amount: Money.fromMinorUnits(100n, 'USD') },
      },
      {
        ...factsFor(customer, GB_PRODUCT, GB_ENTITY),
        actor: { id: 'operator_1', capabilities: [ACTION_TYPES.POST_DEPOSIT] },
        amount: Money.fromMinorUnits(100n, 'USD'),
      },
      NOW,
    );
    assert.equal(result.decision, 'ALLOW');
  });
});
