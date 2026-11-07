import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../domain/src/legal-entity.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import {
  asBeneficialOwnerBindingId,
  asExec08ReconciliationId,
  freezeBeneficialOwnerBinding,
} from '../../../custody/src/execution-connectivity/index.ts';
import { asInstrumentId } from '../ids.ts';
import {
  asExternalBrokerAccountId,
  asExternalCashPositionId,
  asExternalSecurityPositionId,
  cashAvailabilityMinorUnits,
  freezeExternalBrokerAccount,
  freezeExternalCashPosition,
  freezeExternalSecurityPosition,
  reconcileBrokerProviderToLedger,
} from './index.ts';
import { assetAvailabilityFromParts } from '../../../custody/src/execution-connectivity/index.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec08_b');

describe('HELIOS EXEC08 investments execution connectivity', () => {
  it('maps external broker account to beneficial owner without ledger truth claims', () => {
    const binding = freezeBeneficialOwnerBinding({
      bindingId: asBeneficialOwnerBindingId('bob_broker_1'),
      externalAccountId: 'ext_broker_1',
      beneficialCustomerId: CUSTOMER,
      sunReyEconomicAccountRef: 'inv_acct_1',
      representationModel: 'OMNIBUS',
      status: 'ACTIVE',
      effectiveFrom: NOW,
      evidenceRefs: ['evidence:broker-binding:1'],
      providerBalanceIsLedgerTruth: false,
    });
    const account = freezeExternalBrokerAccount({
      schema: 'sunrey.external-broker-account.v1',
      accountId: asExternalBrokerAccountId('ext_broker_acct_1'),
      provider: 'sandbox_broker_v1',
      providerAccountRef: 'broker_ref_1',
      representationModel: 'OMNIBUS',
      legalOwner: Object.freeze({
        legalEntityId: asLegalEntityId('le_sunrey_sim'),
        providerLegalOwnerRef: 'broker_owner_1',
        registrationRef: null,
      }),
      beneficialOwnerBindings: Object.freeze([binding]),
      currency: 'USD',
      jurisdiction: asJurisdiction('US'),
      status: 'ACTIVE',
      permissions: Object.freeze(['READ_BALANCES', 'SUBMIT_ORDERS']),
      evidenceRefs: Object.freeze(['evidence:broker-account:1']),
      updatedAt: NOW,
      simulation: true,
      legalSuitabilityClaimed: false,
      providerBalanceIsLedgerTruth: false,
    });
    assert.equal(account.representationModel, 'OMNIBUS');
    assert.equal(account.providerBalanceIsLedgerTruth, false);
  });

  it('splits cash and security positions by availability state', () => {
    const cash = freezeExternalCashPosition({
      positionId: asExternalCashPositionId('ecp_1'),
      brokerAccountId: asExternalBrokerAccountId('ext_broker_acct_1'),
      provider: 'sandbox_broker_v1',
      currency: 'USD',
      availability: cashAvailabilityMinorUnits('USD', {
        AVAILABLE: Money.fromMinorUnits(250_000n, 'USD'),
        UNSETTLED: Money.fromMinorUnits(50_000n, 'USD'),
      }),
      ledgerCashMinorUnits: 300_000n,
      asOf: NOW,
      evidenceRefs: Object.freeze(['evidence:cash:1']),
      providerBalanceIsLedgerTruth: false,
      simulation: true,
    });
    assert.equal(cash.availability.providerReportedTotal, 300_000n);

    const security = freezeExternalSecurityPosition({
      positionId: asExternalSecurityPositionId('esp_1'),
      brokerAccountId: asExternalBrokerAccountId('ext_broker_acct_1'),
      provider: 'sandbox_broker_v1',
      instrumentId: asInstrumentId('inst_spy'),
      availability: assetAvailabilityFromParts(asInstrumentId('inst_spy'), {
        SETTLED: 100n,
        HELD: 10n,
      }),
      ledgerQuantityMinorUnits: 110n,
      asOf: NOW,
      evidenceRefs: Object.freeze(['evidence:sec:1']),
      providerBalanceIsLedgerTruth: false,
      simulation: true,
    });
    assert.equal(security.availability.providerReportedTotal, 110n);
  });

  it('reconciles broker positions to ledger without silent sync', () => {
    const report = reconcileBrokerProviderToLedger({
      reconciliationId: asExec08ReconciliationId('brec_exec08'),
      asOf: NOW,
      cashScopes: Object.freeze([
        Object.freeze({
          currency: 'USD',
          providerAvailability: cashAvailabilityMinorUnits('USD', {
            AVAILABLE: Money.fromMinorUnits(100n, 'USD'),
          }),
          sunReyLedgerCashMinorUnits: 200n,
          beneficialOwnerMapped: true,
        }),
      ]),
      securityScopes: Object.freeze([]),
    });
    assert.equal(report.matched, false);
    assert.equal(report.silentBalanceSynchronization, false);
    assert.equal(report.breaks[0]?.autoSynchronized, false);
  });
});
