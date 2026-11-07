/**
 * HELIOS EXEC01 — broker execution connectivity domain qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { exec01InvestmentExecutionPosture } from '../packages/kernel/src/regulated/exec01-investment-execution.ts';
import { PaperBrokerProvider } from '../packages/investments/src/broker-port.ts';
import {
  BROKER_CONNECTIVITY_STATES,
  EXEC01_CONNECTIVITY_IMPLIES_LEGAL_AUTHORIZATION,
  HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
  adaptPaperBrokerToExec01Provider,
  exec01SandboxConnectivityEnvelopeFixture,
  paperBrokerProviderRegistration,
} from '../packages/investments/src/broker-connectivity/index.ts';
import {
  EXEC01_CANONICAL_OWNER_REUSE,
  EXEC01_EXPLICIT_NON_OWNERS,
  EXEC01_OWNER_AUDIT_RECORDS,
  evaluateExec01Qualification,
  HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED,
} from '../packages/platform/src/helios/execution-connectivity/exec01/index.ts';
import { heliosOrderToExec01BrokerOrderRequest } from '../packages/platform/src/helios/order-lifecycle/exec01-bridge.ts';
import { HELIOS_H23_EXEC01_SCHEMA_REF } from '../packages/platform/src/helios/order-lifecycle/exec01-schema.ts';
import type { HeliosOrder } from '../packages/platform/src/helios/order-lifecycle/types.ts';
import { exec01BrokerMarketAccessOverlay } from '../packages/sunrey-exchange/src/regulated/exec01-broker-access.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');

describe('HELIOS EXEC01 execution connectivity', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('declares six connectivity states without legal authorization implication', () => {
    assert.equal(BROKER_CONNECTIVITY_STATES.length, 6);
    assert.equal(EXEC01_CONNECTIVITY_IMPLIES_LEGAL_AUTHORIZATION, false);
    assert.ok(BROKER_CONNECTIVITY_STATES.includes('PRODUCTION_DISABLED'));
  });

  it('paper broker remains intact and maps to EXEC01 provider', () => {
    const paper = new PaperBrokerProvider();
    const registration = paperBrokerProviderRegistration(NOW);
    const exec01 = adaptPaperBrokerToExec01Provider(paper, registration);
    assert.equal(exec01.liveProviderConnected, false);
    assert.equal(exec01.grantsExecutionAuthority, false);
    assert.equal(exec01.environment, 'PAPER');
    assert.equal(typeof paper.submitPaperOrder, 'function');
  });

  it('sandbox connectivity envelope is simulation-only', () => {
    const envelope = exec01SandboxConnectivityEnvelopeFixture();
    assert.equal(envelope.schema, HELIOS_EXEC01_CONNECTIVITY_SCHEMA);
    assert.equal(envelope.grantsExecutionAuthority, false);
    assert.equal(envelope.liveInvestmentExecution, false);
    assert.equal(envelope.connectivityState, 'SANDBOX');
  });

  it('H23 schema ref aligns with EXEC01', () => {
    assert.equal(HELIOS_H23_EXEC01_SCHEMA_REF, HELIOS_EXEC01_CONNECTIVITY_SCHEMA);
  });

  it('maps HeliosOrder to BrokerOrderRequest', () => {
    const order: HeliosOrder = {
      orderId: 'ord_fixture_1',
      operationId: 'op_fixture_1',
      externalOperationId: 'ext_op_fixture_1',
      customerId: 'cust_1',
      providerAccountId: 'prov_acct_1',
      workOrderId: 'wo_1',
      strategyCapsuleRef: null,
      proposalId: 'prop_1',
      envelopeId: null,
      authorityReference: null,
      instrumentId: 'inst_1',
      side: 'BUY',
      quantityUnits: '100000000',
      notionalMinorUnits: '10000',
      orderType: 'MARKET',
      limitPriceMinorUnits: null,
      timeInForce: 'DAY',
      currency: 'GBP',
      providerRoute: 'sandbox_helios_investment_v1',
      environment: 'SANDBOX',
      status: 'DRAFT',
      cancelStatus: null,
      providerOrderId: null,
      reservationId: null,
      capitalReservedMinorUnits: '0',
      idempotencyKey: 'idem_1',
      createdAt: NOW,
      updatedAt: NOW,
      submittedAt: null,
      acknowledgedAt: null,
      filledAt: null,
      settledAt: null,
      reconciledAt: null,
      availableAt: null,
      liveExecution: false,
      productionAuthorized: false,
      grantsFinancialEffect: false,
    };
    const mapped = heliosOrderToExec01BrokerOrderRequest(order);
    assert.equal(mapped.externalOperationId, order.externalOperationId);
    assert.equal(mapped.simulation, true);
    assert.equal(mapped.liveSecuritiesExecution, false);
  });

  it('regulated overlay denies live order entry', () => {
    const overlay = exec01BrokerMarketAccessOverlay('sandbox_helios_investment_v1');
    assert.equal(overlay.orderEntryPermitted, false);
    assert.equal(overlay.legalAuthorizationImplied, false);
  });

  it('kernel posture keeps live investment execution false', () => {
    const posture = exec01InvestmentExecutionPosture();
    assert.equal(posture.liveInvestmentExecution, false);
    assert.equal(posture.connectivityStateImpliesLegalAuthorization, false);
  });

  it('qualifies HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED when engineering checks pass', () => {
    const qualification = evaluateExec01Qualification({
      canonicalTypesDeclared: true,
      connectivityStatesDeclared: BROKER_CONNECTIVITY_STATES.length === 6,
      paperBrokerIntact: true,
      noStateImpliesLegalAuthorization: !EXEC01_CONNECTIVITY_IMPLIES_LEGAL_AUTHORIZATION,
      liveInvestmentExecutionFalse: LIVE_INVESTMENT_EXECUTION === false,
      noParallelBrokerPackages: EXEC01_EXPLICIT_NON_OWNERS.some((row) => row.includes('packages/brokerage')),
      extendsCanonicalOwners: EXEC01_CANONICAL_OWNER_REUSE.length >= 10,
      ownerAuditComplete: EXEC01_OWNER_AUDIT_RECORDS.length >= 8,
      h23BridgePresent: true,
      grantsExecutionAuthorityFalse: true,
    });
    assert.equal(qualification.marker, HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.qualified, true);
  });
});
