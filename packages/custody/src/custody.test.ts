import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { assignCase, decideCase } from '../../kernel/src/compliance/cases.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import { SubjectScopedCustodyTool } from './agent-tool.ts';
import { InMemoryCustomerAssetPort } from './asset-adapter.ts';
import { asCustodyAccountId } from './ids.ts';
import { KeyProviderTravelRuleProtection } from './protection.ts';
import { CustodyService } from './service.ts';
import {
  SimulationCustodyProvider,
  SimulationDestinationRiskProvider,
  SimulationTravelRuleNetwork,
  signSimulationNotice,
} from './simulation.ts';
import { GB_SIMULATION_TRAVEL_RULE_PACK } from './travel-rule.ts';

const NOW = asUtcInstant('2026-08-16T07:00:00.000Z');
const GB = asJurisdiction('GB');
const CAPS = [
  'CUSTODY_OPERATE_REQUEST',
  'ADD_WITHDRAWAL_DESTINATION',
  'SUNREY_COIN_VIEW',
  'EXCHANGE_VIEW',
] as const;

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-16T07:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function coins(whole: bigint): AssetQuantity {
  return AssetQuantity.fromScaledUnits(whole * 1_000_000n, SUNREY_COIN_ASSET_ID);
}

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('custody-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const assets = new InMemoryCustomerAssetPort();
  const provider = new SimulationCustodyProvider();
  const custody = new CustodyService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    assets,
    provider,
    destinationRisk: new SimulationDestinationRiskProvider(),
    travelNetwork: new SimulationTravelRuleNetwork(),
    protection: new KeyProviderTravelRuleProtection(keys),
    pack: GB_SIMULATION_TRAVEL_RULE_PACK,
  });
  return { clock, events, evidence, identity, customers, assets, provider, custody, keys };
}

function provision(h: ReturnType<typeof harness>, actorId: string, identityId: string, customerId: string) {
  const cust = customer(customerId);
  h.customers.set(cust.id, cust);
  const result = h.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: cust.id,
    capabilities: [...CAPS] as never,
    stepUp: true,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { customer: cust, actor: result.value };
}

describe('SunRey custody control plane', () => {
  it('credits only after authenticated notice, mapping, screening, finality, policy, and Kernel EA', () => {
    const h = harness();
    const { customer: cust, actor } = provision(h, 'actor_dep', 'id_dep', 'cust_dep');
    const custodyAccountId = asCustodyAccountId('cust_dep');
    h.provider.mapCustomerAddress('simaddr_alice', custodyAccountId, cust.id);
    h.custody.registerAddress('simaddr_alice', cust.id, custodyAccountId);
    const material = 'notice:dep1:simaddr_alice:1000000';
    const notice = {
      noticeId: 'dep1',
      providerId: 'SIMULATION_CUSTODY' as const,
      signatureValid: true,
      assetId: SUNREY_COIN_ASSET_ID,
      quantity: coins(1n),
      destinationAddress: 'simaddr_alice',
      txRef: 'simtx_in_1',
      confirmations: 6,
      receivedAt: NOW,
    };
    const ingested = h.custody.ingestExternalDeposit({
      material,
      signatureHex: signSimulationNotice(material),
      notice,
    });
    if (ingested.outcome !== 'OK') {
      throw new Error('ingest failed');
    }
    assert.equal(ingested.value.state, 'NOTICE_RECEIVED');
    assert.equal(ingested.value.journalId, null);
    const credited = h.custody.creditExternalDeposit({ actorId: actor.actorId, depositId: ingested.value.depositId });
    if (credited.outcome !== 'OK') {
      throw new Error(credited.outcome === 'REJECTED' ? credited.message : credited.decision.status);
    }
    assert.equal(credited.outcome, 'OK');
    assert.equal(credited.value.state, 'CREDITED');
    assert.ok(credited.value.journalId);
    assert.equal(credited.value.providerBalanceIsTruth, false);
    assert.equal(h.assets.position(cust.id, SUNREY_COIN_ASSET_ID).available.scaledUnits, 1_000_000n);
  });

  it('rejects an unauthenticated provider notice and never credits from the webhook', () => {
    const h = harness();
    const { customer: cust } = provision(h, 'actor_bad', 'id_bad', 'cust_bad');
    h.provider.mapCustomerAddress('simaddr_bad', asCustodyAccountId('cust_bad'), cust.id);
    const ingested = h.custody.ingestExternalDeposit({
      material: 'notice:bad',
      signatureHex: '00',
      notice: {
        noticeId: 'bad',
        providerId: 'SIMULATION_CUSTODY',
        signatureValid: true,
        assetId: SUNREY_COIN_ASSET_ID,
        quantity: coins(1n),
        destinationAddress: 'simaddr_bad',
        txRef: 'x',
        confirmations: 6,
        receivedAt: NOW,
      },
    });
    assert.equal(ingested.outcome, 'REJECTED');
    if (ingested.outcome === 'REJECTED') {
      assert.equal(ingested.code, 'UNAUTHENTICATED_NOTICE');
    }
  });

  it('runs the required withdrawal, block, and SUBMISSION_UNKNOWN scenarios', () => {
    const h = harness();
    const { customer: cust, actor } = provision(h, 'actor_wd', 'id_wd', 'cust_wd');
    const custodyAccountId = asCustodyAccountId('cust_wd');
    h.assets.seed(cust.id, coins(10n), custodyAccountId);
    const destination = h.custody.addDestination({
      actor,
      customerId: cust.id,
      address: 'simaddr_vasp_clear',
      label: 'simulation vasp',
    });
    if (destination.outcome !== 'OK') {
      throw new Error(destination.outcome === 'REJECTED' ? destination.message : destination.decision.status);
    }
    assert.equal(destination.outcome, 'OK');
    const withdrawn = h.custody.initiateWithdrawal({
      actor,
      customerId: cust.id,
      custodyAccountId,
      destinationId: destination.value.destinationId,
      quantity: coins(2n),
    });
    if (withdrawn.outcome !== 'OK') {
      throw new Error(withdrawn.outcome === 'REJECTED' ? withdrawn.message : withdrawn.decision.status);
    }
    assert.equal(withdrawn.outcome, 'OK');
    assert.equal(withdrawn.value.state, 'SETTLED');
    assert.equal(withdrawn.value.screeningOutcome, 'CLEAR');
    assert.equal(withdrawn.value.travelRule?.applicability, 'REQUIRED_BY_PACK');
    assert.equal(withdrawn.value.travelRule?.legalStatus, 'RESEARCH_REQUIRED');
    assert.ok(withdrawn.value.travelRuleMessageId);
    const message = h.custody.travelMessage(withdrawn.value.travelRuleMessageId!);
    assert.ok(message);
    assert.equal(message.acknowledged, true);
    assert.equal(message.piiInEvents, false);
    assert.ok(message.envelope.ciphertext);
    const recon = h.custody.reconcile();
    assert.equal(recon.outcome, 'MATCHED');
    assert.equal(recon.autoCorrected, false);

    const risky = h.custody.addDestination({
      actor,
      customerId: cust.id,
      address: 'simaddr_high-risk',
      label: 'blocked dest',
    });
    if (risky.outcome !== 'OK') {
      throw new Error('risky dest');
    }
    const blocked = h.custody.initiateWithdrawal({
      actor,
      customerId: cust.id,
      custodyAccountId,
      destinationId: risky.value.destinationId,
      quantity: coins(1n),
    });
    assert.equal(blocked.outcome, 'REJECTED');
    if (blocked.outcome === 'REJECTED') {
      assert.equal(blocked.code, 'DESTINATION_BLOCK');
    }
    assert.equal(h.custody.cases.length > 0, true);

    const unknown = h.custody.initiateWithdrawal({
      actor,
      customerId: cust.id,
      custodyAccountId,
      destinationId: destination.value.destinationId,
      quantity: coins(1n),
      timeoutAfterBroadcast: true,
    });
    if (unknown.outcome !== 'OK') {
      throw new Error('unknown');
    }
    assert.equal(unknown.value.state, 'SUBMISSION_UNKNOWN');
    assert.equal(unknown.value.submittedOnce, true);
    const firstId = unknown.value.withdrawalId;
    const recovered = h.custody.queryAndReconcileWithdrawal(firstId);
    if (recovered.outcome !== 'OK') {
      throw new Error('recover');
    }
    assert.equal(recovered.value.state, 'MATCHED');
    assert.equal(recovered.value.submittedOnce, true);
    assert.equal(h.custody.getWithdrawal(firstId)?.withdrawalId, firstId);
  });

  it('refuses AI disable of custody kill switches', () => {
    const h = harness();
    const refused = h.custody.setKillSwitch('WITHDRAWAL_HALT', true, 'AI');
    assert.equal(refused.outcome, 'REJECTED');
    if (refused.outcome === 'REJECTED') {
      assert.equal(refused.code, 'AI_CANNOT_DISABLE_CONTROLS');
    }
    const human = h.custody.setKillSwitch('WITHDRAWAL_HALT', true, 'HUMAN_OPERATOR');
    assert.equal(human.outcome, 'OK');
    const { customer: cust, actor } = provision(h, 'actor_halt', 'id_halt', 'cust_halt');
    h.assets.seed(cust.id, coins(2n), asCustodyAccountId('cust_halt'));
    const dest = h.custody.addDestination({
      actor,
      customerId: cust.id,
      address: 'simaddr_vasp_clear',
      label: 'x',
    });
    if (dest.outcome !== 'OK') {
      throw new Error('dest');
    }
    const halted = h.custody.initiateWithdrawal({
      actor,
      customerId: cust.id,
      custodyAccountId: asCustodyAccountId('cust_halt'),
      destinationId: dest.value.destinationId,
      quantity: coins(1n),
    });
    assert.equal(halted.outcome, 'REJECTED');
  });

  it('lets a human update a canonical case and keeps agents from executing', () => {
    const h = harness();
    const opened = h.custody.cases;
    void opened;
    const { actor } = provision(h, 'actor_case', 'id_case', 'cust_case');
    const tool = new SubjectScopedCustodyTool();
    assert.equal(tool.explain(actor).canExecute, false);
    const case_ = {
      ...h.custody['cases'],
    };
    void case_;
    const created = assignCase(
      {
        caseId: 'case_sim',
        caseType: 'TRANSACTION_MONITORING_ALERT',
        status: 'OPEN',
        finality: 'NON_FINAL',
        reasonCodes: ['SURVEILLANCE'],
        originRefs: ['custody'],
        subjectRef: 'cust_case',
        counterpartyRef: null,
        jurisdiction: 'GB',
        policyVersionId: null,
        createdAt: NOW,
        ownerRef: null,
      },
      'reviewer_1',
    );
    const decided = decideCase(created, {
      decision: 'RESTRICT',
      operatorRef: 'reviewer_1',
      actorKind: 'HUMAN_OPERATOR',
      reason: 'human restriction proposal',
      evidenceRefs: ['alert_1'],
      decidedAt: NOW,
    });
    assert.equal(decided.ok, true);
    const ai = decideCase(created, {
      decision: 'BLOCK',
      operatorRef: 'agent',
      actorKind: 'AI',
      reason: 'autonomous',
      evidenceRefs: [],
      decidedAt: NOW,
    });
    assert.equal(ai.ok, false);
  });

  it('does not credit a native-chain mempool receipt and requires BFT finality', () => {
    const h = harness();
    const { customer: cust, actor } = provision(h, 'actor_bft', 'id_bft', 'cust_bft');
    const custodyAccountId = asCustodyAccountId('cust_bft');
    const address = h.custody.allocateExchangeDepositAddress({
      customerId: cust.id,
      custodyAccountId,
      exchangeAccountId: 'xacct_alice',
    });
    h.provider.mapCustomerAddress(address, custodyAccountId, cust.id);
    const mempoolMaterial = 'notice:mempool:sr1ex:1000000';
    const mempool = h.custody.ingestExternalDeposit({
      material: mempoolMaterial,
      signatureHex: signSimulationNotice(mempoolMaterial),
      notice: {
        noticeId: 'dep_mempool',
        providerId: 'SIMULATION_CUSTODY',
        signatureValid: true,
        assetId: SUNREY_COIN_ASSET_ID,
        quantity: coins(1n),
        destinationAddress: address,
        txRef: 'sr_tx_mempool',
        confirmations: 0,
        receivedAt: NOW,
        finality: 'MEMPOOL',
      },
    });
    if (mempool.outcome !== 'OK') {
      throw new Error('ingest failed');
    }
    const waiting = h.custody.creditExternalDeposit({ actorId: actor.actorId, depositId: mempool.value.depositId });
    assert.equal(waiting.outcome, 'REJECTED');
    if (waiting.outcome === 'REJECTED') {
      assert.equal(waiting.code, 'AWAITING_FINALITY');
    }
    const finalMaterial = 'notice:bft:sr1ex:1000000';
    const finalized = h.custody.ingestExternalDeposit({
      material: finalMaterial,
      signatureHex: signSimulationNotice(finalMaterial),
      notice: {
        noticeId: 'dep_bft',
        providerId: 'SIMULATION_CUSTODY',
        signatureValid: true,
        assetId: SUNREY_COIN_ASSET_ID,
        quantity: coins(1n),
        destinationAddress: address,
        txRef: 'sr_tx_final',
        confirmations: 0,
        receivedAt: NOW,
        finality: 'BFT_FINALIZED',
      },
    });
    if (finalized.outcome !== 'OK') {
      throw new Error('final ingest failed');
    }
    const credited = h.custody.creditExternalDeposit({ actorId: actor.actorId, depositId: finalized.value.depositId });
    if (credited.outcome !== 'OK') {
      throw new Error(credited.outcome === 'REJECTED' ? credited.message : credited.decision.status);
    }
    assert.equal(credited.value.state, 'CREDITED');
  });
});
