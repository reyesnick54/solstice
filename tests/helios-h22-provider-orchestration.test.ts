import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  assessProviderOrchestrationReadiness,
  createSimulatedCustodyWalletAdapter,
  createSimulatedFundingAdapter,
  createSimulatedInvestmentAdapter,
  externalAccountApplicationIdFor,
  fundingOperationIdFor,
  fundingRelationshipIdFor,
  HeliosProviderOrchestrationService,
} from '../packages/platform/src/helios/index.ts';
import { persistProviderOrchestrationState, loadProviderOrchestrationState } from '../packages/persistence/src/growth/pg-helios-provider-orchestration-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../packages/persistence/src/postgres/pools.ts';
import { persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary as lintBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T14:00:00.000Z');

type Harness = {
  readonly clock: FrozenClock;
  readonly service: HeliosProviderOrchestrationService;
  readonly investment: ReturnType<typeof createSimulatedInvestmentAdapter>;
  readonly funding: ReturnType<typeof createSimulatedFundingAdapter>;
  readonly custody: ReturnType<typeof createSimulatedCustodyWalletAdapter>;
  readonly evidence: EvidenceVault;
};

function runtimeFromHarness(h: Harness) {
  return {
    get(providerId: string) {
      if (providerId === 'sim-investments') {
        return {
          providerId,
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['INVESTMENT.PAPER_ORDER', 'INVESTMENT.FUND', 'INVESTMENT.SETTLE'],
          credentialConfigured: true,
        };
      }
      if (providerId === 'sim-custody') {
        return {
          providerId,
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['CUSTODY.WALLET', 'CUSTODY.DEPOSIT'],
          credentialConfigured: true,
        };
      }
      return null;
    },
    list() {
      return [
        {
          providerId: 'sim-investments',
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['INVESTMENT.PAPER_ORDER', 'INVESTMENT.FUND'],
          credentialConfigured: true,
        },
        {
          providerId: 'sim-custody',
          lifecycleState: 'SIMULATED',
          environment: 'LOCAL',
          healthState: 'HEALTHY',
          capabilities: ['CUSTODY.WALLET'],
          credentialConfigured: true,
        },
      ];
    },
  };
}

function harness(): Harness {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const investment = createSimulatedInvestmentAdapter('sim-investments');
  const funding = createSimulatedFundingAdapter('sim-investments');
  const custody = createSimulatedCustodyWalletAdapter('sim-custody');
  const service = new HeliosProviderOrchestrationService({
    clock,
    evidence,
    ports: {
      runtime: runtimeFromHarness({} as Harness),
      investmentAdapters: { 'sim-investments': investment },
      fundingAdapters: { 'sim-investments': funding },
      custodyAdapters: { 'sim-custody': custody },
    },
  });
  return { clock, service, investment, funding, custody, evidence };
}

function baseApplicationRequest(customerId: string, idempotencyKey = 'app-key-1') {
  return {
    customerId: asCustomerId(customerId),
    legalIdentityRef: 'id_ref_verified',
    kycState: 'VERIFIED',
    jurisdiction: asJurisdiction('US'),
    productRequested: 'brokerage_cash',
    providerId: 'sim-investments',
    accountType: 'BROKERAGE_CASH' as const,
    requiredAgreements: Object.freeze(['customer_agreement', 'risk_disclosure']),
    idempotencyKey,
    workOrderRef: 'ewo_h22_test',
    growRef: 'grow_h22_test',
    environment: 'simulation' as const,
  };
}

describe('HELIOS H22 — provider account / funding / wallet orchestration', () => {
  it('architecture guard: provider orchestration stays within HELIOS boundary', () => {
    const findings = lintBoundary(process.cwd()).filter((f) =>
      f.file.includes('provider-orchestration'),
    );
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
    const globalFindings = lintBoundary(process.cwd());
    assert.equal(globalFindings.length, 0, globalFindings.map((f) => f.message).join('; '));
  });

  it('1. valid provider account application', () => {
    const ctx = harness();
    const result = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_a'));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, 'APPROVED');
    assert.equal(result.value.customerId, 'cust_h22_a');
    assert.ok(result.value.providerAccountRef?.startsWith('sim_acct_'));
    assert.equal(result.value.latestEvidence?.providerObjectId !== null, true);
    assert.equal(result.value.reconciliationRequired, false);
  });

  it('2. duplicate application idempotency', () => {
    const ctx = harness();
    const request = baseApplicationRequest('cust_h22_b', 'dup-app-key');
    const first = ctx.service.submitAccountApplication(request);
    const second = ctx.service.submitAccountApplication(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.value.applicationId, second.value.applicationId);
    assert.equal(ctx.service.store.listApplicationsForCustomer(asCustomerId('cust_h22_b')).length, 1);
  });

  it('3. action-required application', () => {
    const ctx = harness();
    ctx.investment.setAccountScenario('action-app-key', 'action_required');
    const result = ctx.service.submitAccountApplication(
      baseApplicationRequest('cust_h22_c', 'action-app-key'),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, 'ACTION_REQUIRED');
    assert.equal(result.value.actionRequirements.length, 1);
    assert.equal(result.value.actionRequirements[0]?.aiMayComplete, false);
    assert.equal(result.value.actionRequirements[0]?.kind, 'TAX_FORM');
    const requirements = ctx.service.listActionRequirements(asCustomerId('cust_h22_c'));
    assert.equal(requirements.length, 1);
  });

  it('4. rejection', () => {
    const ctx = harness();
    ctx.investment.setAccountScenario('reject-app-key', 'reject');
    const result = ctx.service.submitAccountApplication(
      baseApplicationRequest('cust_h22_d', 'reject-app-key'),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, 'REJECTED');
    assert.equal(result.value.providerAccountRef, null);
  });

  it('5. unknown status', () => {
    const ctx = harness();
    ctx.investment.setAccountScenario('unknown-app-key', 'unknown');
    const result = ctx.service.submitAccountApplication(
      baseApplicationRequest('cust_h22_e', 'unknown-app-key'),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, 'UNKNOWN');
    assert.equal(result.value.reconciliationRequired, true);
    assert.equal(result.value.providerAccountRef, null);
  });

  it('6. funding request', () => {
    const ctx = harness();
    const customerId = asCustomerId('cust_h22_f');
    const app = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_f', 'fund-app'));
    assert.equal(app.ok, true);
    if (!app.ok) return;
    const relationship = ctx.service.registerFundingRelationship({
      customerId,
      sourceAccountRef: 'owned:cust_h22_f:checking_001',
      destinationProviderAccountRef: app.value.providerAccountRef!,
      currency: 'USD',
      supportedRails: ['ACH'],
      providerId: 'sim-investments',
      environment: 'simulation',
    });
    assert.equal(relationship.ok, true);
    if (!relationship.ok) return;
    const funding = ctx.service.submitFundingRequest({
      customerId,
      relationshipId: relationship.value.relationshipId,
      providerId: 'sim-investments',
      destinationAccountRef: app.value.providerAccountRef!,
      amountMinor: '500000',
      currency: 'USD',
      idempotencyKey: 'fund-key-1',
      environment: 'simulation',
    });
    assert.equal(funding.ok, true);
    if (!funding.ok) return;
    assert.equal(funding.value.status, 'SETTLED');
    assert.equal(funding.value.buyingPowerCredited, false);
  });

  it('7. funding settlement via reconciliation', () => {
    const ctx = harness();
    const customerId = asCustomerId('cust_h22_g');
    const app = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_g', 'settle-app'));
    assert.equal(app.ok, true);
    if (!app.ok) return;
    const relationship = ctx.service.registerFundingRelationship({
      customerId,
      sourceAccountRef: 'owned:cust_h22_g:checking_001',
      destinationProviderAccountRef: app.value.providerAccountRef!,
      currency: 'USD',
      supportedRails: ['ACH'],
      providerId: 'sim-investments',
      environment: 'simulation',
    });
    assert.equal(relationship.ok, true);
    if (!relationship.ok) return;
    ctx.funding.setFundingScenario('settle-fund-key', 'settle_delayed');
    const funding = ctx.service.submitFundingRequest({
      customerId,
      relationshipId: relationship.value.relationshipId,
      providerId: 'sim-investments',
      destinationAccountRef: app.value.providerAccountRef!,
      amountMinor: '250000',
      currency: 'USD',
      idempotencyKey: 'settle-fund-key',
      environment: 'simulation',
    });
    assert.equal(funding.ok, true);
    if (!funding.ok) return;
    assert.equal(funding.value.status, 'PENDING');
    ctx.clock.advanceMs(2000n);
    const reconciled = ctx.service.reconcileFundingOperation(
      funding.value.operationId,
      customerId,
    );
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) return;
    assert.equal(reconciled.value.status, 'SETTLED');
  });

  it('8. funding failure', () => {
    const ctx = harness();
    const customerId = asCustomerId('cust_h22_h');
    const app = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_h', 'fail-fund-app'));
    assert.equal(app.ok, true);
    if (!app.ok) return;
    const relationship = ctx.service.registerFundingRelationship({
      customerId,
      sourceAccountRef: 'owned:cust_h22_h:checking_001',
      destinationProviderAccountRef: app.value.providerAccountRef!,
      currency: 'USD',
      supportedRails: ['ACH'],
      providerId: 'sim-investments',
      environment: 'simulation',
    });
    assert.equal(relationship.ok, true);
    if (!relationship.ok) return;
    ctx.funding.setFundingScenario('fail-fund-key', 'fail');
    const funding = ctx.service.submitFundingRequest({
      customerId,
      relationshipId: relationship.value.relationshipId,
      providerId: 'sim-investments',
      destinationAccountRef: app.value.providerAccountRef!,
      amountMinor: '100000',
      currency: 'USD',
      idempotencyKey: 'fail-fund-key',
      environment: 'simulation',
    });
    assert.equal(funding.ok, true);
    if (!funding.ok) return;
    assert.equal(funding.value.status, 'FAILED');
    assert.equal(funding.value.buyingPowerCredited, false);
  });

  it('9. duplicate funding retry', () => {
    const ctx = harness();
    const customerId = asCustomerId('cust_h22_i');
    const app = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_i', 'dup-fund-app'));
    assert.equal(app.ok, true);
    if (!app.ok) return;
    const relationship = ctx.service.registerFundingRelationship({
      customerId,
      sourceAccountRef: 'owned:cust_h22_i:checking_001',
      destinationProviderAccountRef: app.value.providerAccountRef!,
      currency: 'USD',
      supportedRails: ['ACH'],
      providerId: 'sim-investments',
      environment: 'simulation',
    });
    assert.equal(relationship.ok, true);
    if (!relationship.ok) return;
    const request = {
      customerId,
      relationshipId: relationship.value.relationshipId,
      providerId: 'sim-investments',
      destinationAccountRef: app.value.providerAccountRef!,
      amountMinor: '750000',
      currency: 'USD',
      idempotencyKey: 'dup-fund-retry',
      environment: 'simulation' as const,
    };
    const first = ctx.service.submitFundingRequest(request);
    const second = ctx.service.submitFundingRequest(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.value.operationId, second.value.operationId);
    assert.equal(ctx.service.store.listFundingForCustomer(customerId).length, 1);
  });

  it('10. customer ownership — applications and funding remain customer-bound', () => {
    const ctx = harness();
    const app = ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_owner_a', 'owner-app'));
    assert.equal(app.ok, true);
    if (!app.ok) return;
    const crossRead = ctx.service.getApplicationForCustomer(
      app.value.applicationId,
      asCustomerId('cust_h22_owner_b'),
    );
    assert.equal(crossRead.ok, false);
    if (crossRead.ok) return;
    assert.equal(crossRead.error.code, 'CUSTOMER_MISMATCH');
  });

  it('11. wallet provisioning', () => {
    const ctx = harness();
    const result = ctx.service.provisionWallet({
      customerId: asCustomerId('cust_h22_wallet'),
      assetId: 'SUNREY_COIN',
      networkId: 'sunrey-simulation',
      custodyProviderId: 'sim-custody',
      signingPolicyRef: 'policy_customer_bound_v1',
      idempotencyKey: 'wallet-key-1',
      environment: 'simulation',
      requiredByProduct: 'grow_digital_asset_optional',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, 'PROVISIONED');
    assert.ok(result.value.addressOrReference?.startsWith('sim_addr_'));
    assert.equal(result.value.customerId, 'cust_h22_wallet');
  });

  it('12. signing credentials not exposed to agent', () => {
    const ctx = harness();
    const provision = ctx.service.provisionWallet({
      customerId: asCustomerId('cust_h22_agent'),
      assetId: 'SUNREY_COIN',
      networkId: 'sunrey-simulation',
      custodyProviderId: 'sim-custody',
      signingPolicyRef: 'policy_customer_bound_v1',
      idempotencyKey: 'wallet-agent-key',
      environment: 'simulation',
      requiredByProduct: 'research_only',
    });
    assert.equal(provision.ok, true);
    if (!provision.ok) return;
    const agentAccess = ctx.service.exposeWalletToAgent(
      provision.value.provisionId,
      asCustomerId('cust_h22_agent'),
    );
    assert.equal(agentAccess.ok, false);
    if (agentAccess.ok) return;
    assert.equal(agentAccess.error.code, 'SIGNING_MATERIAL_FORBIDDEN');
  });

  it('13. duplicate wallet request', () => {
    const ctx = harness();
    const request = {
      customerId: asCustomerId('cust_h22_wallet_dup'),
      assetId: 'SUNREY_COIN',
      networkId: 'sunrey-simulation',
      custodyProviderId: 'sim-custody',
      signingPolicyRef: 'policy_customer_bound_v1',
      idempotencyKey: 'wallet-dup-key',
      environment: 'simulation' as const,
      requiredByProduct: 'grow',
    };
    const first = ctx.service.provisionWallet(request);
    const second = ctx.service.provisionWallet(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.value.provisionId, second.value.provisionId);
  });

  it('14. provider unavailable', () => {
    const ctx = harness();
    ctx.investment.markProviderUnavailable();
    const result = ctx.service.submitAccountApplication(
      baseApplicationRequest('cust_h22_unavail', 'unavail-app'),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'PROVIDER_UNAVAILABLE');
  });

  it('15. restart recovery preserves state without duplicate provisioning', () => {
    const ctx = harness();
    const request = baseApplicationRequest('cust_h22_restart', 'restart-app');
    const submitted = ctx.service.submitAccountApplication(request);
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const snapshot = ctx.service.snapshot();
    const restarted = HeliosProviderOrchestrationService.fromSnapshot({
      clock: ctx.clock,
      evidence: ctx.evidence,
      ports: {
        runtime: runtimeFromHarness(ctx),
        investmentAdapters: { 'sim-investments': ctx.investment },
        fundingAdapters: { 'sim-investments': ctx.funding },
        custodyAdapters: { 'sim-custody': ctx.custody },
      },
      snapshot,
    });
    const retry = restarted.submitAccountApplication(request);
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.value.applicationId, submitted.value.applicationId);
    assert.equal(restarted.store.listApplicationsForCustomer(asCustomerId('cust_h22_restart')).length, 1);
  });

  it('16. cross-customer isolation for wallets and action requirements', () => {
    const ctx = harness();
    ctx.investment.setAccountScenario('iso-action-key', 'action_required');
    ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_iso_a', 'iso-action-key'));
    const wallet = ctx.service.provisionWallet({
      customerId: asCustomerId('cust_h22_iso_a'),
      assetId: 'SUNREY_COIN',
      networkId: 'sunrey-simulation',
      custodyProviderId: 'sim-custody',
      signingPolicyRef: 'policy_v1',
      idempotencyKey: 'iso-wallet',
      environment: 'simulation',
      requiredByProduct: 'grow',
    });
    assert.equal(wallet.ok, true);
    if (!wallet.ok) return;
    const crossWallet = ctx.service.getWalletForCustomer(
      wallet.value.provisionId,
      asCustomerId('cust_h22_iso_b'),
    );
    assert.equal(crossWallet.ok, false);
    const bRequirements = ctx.service.listActionRequirements(asCustomerId('cust_h22_iso_b'));
    assert.equal(bRequirements.length, 0);
  });

  it('17. no agent financial ownership', () => {
    const ctx = harness();
    const ownership = ctx.service.assertHeliosNotAccountOwner();
    assert.equal(ownership.heliosIsAccountOwner, false);
    assert.equal(ownership.customerBound, true);
    const unverifiedFunding = ctx.service.registerFundingRelationship({
      customerId: asCustomerId('cust_h22_unverified'),
      sourceAccountRef: 'unverified:acct_999',
      destinationProviderAccountRef: 'sim_acct_x',
      currency: 'USD',
      supportedRails: ['ACH'],
      providerId: 'sim-investments',
      environment: 'simulation',
    });
    assert.equal(unverifiedFunding.ok, false);
    if (unverifiedFunding.ok) return;
    assert.equal(unverifiedFunding.error.code, 'RELATIONSHIP_UNVERIFIED');
  });

  it('18. no fabricated provider approval — PENDING is not APPROVED', () => {
    const ctx = harness();
    ctx.investment.setAccountScenario('pending-app-key', 'pending_then_approve');
    const pending = ctx.service.submitAccountApplication(
      baseApplicationRequest('cust_h22_pending', 'pending-app-key'),
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(pending.value.status, 'PENDING');
    assert.notEqual(pending.value.status, 'APPROVED');
    assert.equal(pending.value.providerAccountRef, null);
    ctx.clock.advanceMs(2000n);
    const reconciled = ctx.service.reconcileAccountApplication(
      pending.value.applicationId,
      asCustomerId('cust_h22_pending'),
    );
    assert.equal(reconciled.ok, true);
    if (!reconciled.ok) return;
    assert.equal(reconciled.value.status, 'APPROVED');
    assert.ok(reconciled.value.providerAccountRef);
  });

  it('qualification readiness reports without faking external qualification', () => {
    const ctx = harness();
    const pending = assessProviderOrchestrationReadiness({
      runtime: runtimeFromHarness(ctx),
      environment: 'simulation',
      now: NOW,
      sandboxCredentialsPresent: false,
    });
    assert.equal(pending.readiness, 'EXTERNAL_PROVIDER_QUALIFICATION_PENDING');
    const ready = assessProviderOrchestrationReadiness({
      runtime: runtimeFromHarness(ctx),
      environment: 'simulation',
      now: NOW,
      sandboxCredentialsPresent: true,
    });
    assert.equal(ready.readiness, 'PROVIDER_ORCHESTRATION_READY');
    assert.ok(ready.qualifiedProviderCount >= 1);
  });

  it('stable operation identity for idempotency keys', () => {
    const appId = externalAccountApplicationIdFor('cust_x', 'key-abc');
    const appId2 = externalAccountApplicationIdFor('cust_x', 'key-abc');
    assert.equal(appId, appId2);
    const fundId = fundingOperationIdFor('cust_x', 'fund-abc');
    assert.ok(fundId.startsWith('fop_'));
    const relId = fundingRelationshipIdFor('cust_x', 'owned:cust_x:chk', 'sim_acct_1');
    assert.ok(relId.startsWith('frl_'));
  });
});

describe('HELIOS H22 persistence', () => {
  it('persists and reloads orchestration snapshot when PostgreSQL is available', async (t) => {
    if (!(await persistenceAvailable())) {
      t.skip('PostgreSQL persistence harness unavailable');
      return;
    }
    const ctx = harness();
    ctx.service.submitAccountApplication(baseApplicationRequest('cust_h22_pg', 'pg-app'));
    const snapshot = ctx.service.snapshot();
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    try {
      await persistProviderOrchestrationState(pools.customer, snapshot, NOW);
      const reloaded = await loadProviderOrchestrationState(pools.customer);
      assert.ok(reloaded);
      assert.equal(reloaded!.applications.length, 1);
      assert.equal(reloaded!.applications[0]?.customerId, 'cust_h22_pg');
    } finally {
      await closePersistencePools(pools);
    }
  });
});
