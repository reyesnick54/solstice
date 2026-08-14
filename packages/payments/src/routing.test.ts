import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../domain/src/customer.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { freezeBeneficiary } from './beneficiary.ts';
import { findCorridor } from './corridor.ts';
import { asBeneficiaryId, asScreeningRef } from './ids.ts';
import { selectRoute, simulationRoutesFor } from './route.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

describe('route selection', () => {
  const corridor = findCorridor('US-SA-USD-SAR')!;
  const fee = Money.fromMinorUnits(1_500n, 'USD');
  const beneficiary = freezeBeneficiary({
    beneficiaryId: asBeneficiaryId('ben_r'),
    ownerId: asCustomerId('cust'),
    kind: 'PERSON',
    destinationCountry: 'SA',
    currency: 'SAR',
    legalName: 'Ahmed Ali',
    accountCoordinate: { scheme: 'SA_IBAN', coordinateRef: 'abc', displayHint: '7519' },
    screeningStatus: 'CLEAR',
    screeningRef: asScreeningRef('scr_1'),
    status: 'ACTIVE',
    createdAt: NOW,
  });

  it('never selects the cheaper non-compliant US→SA route', () => {
    const routes = simulationRoutesFor('US-SA-USD-SAR', fee);
    assert.ok(routes.some((row) => row.routeId === 'sim-noncompliant-usd-sar' && row.compliant === false));
    const selection = selectRoute(routes, {
      corridor,
      beneficiary,
      sanctionsHit: false,
      amount: Money.fromMinorUnits(100_000n, 'USD'),
      maxAmount: Money.fromMinorUnits(100_000_000n, 'USD'),
      providerAvailable: true,
    });
    assert.equal(selection.chosen?.routeId, 'sim-gcc-usd-sar');
    assert.ok(selection.rejected.some((row) => row.routeId === 'sim-noncompliant-usd-sar' && row.reason === 'sanctions_or_compliance'));
  });

  it('rejects every candidate when the provider is unavailable', () => {
    const selection = selectRoute(simulationRoutesFor('US-SA-USD-SAR', fee), {
      corridor,
      beneficiary,
      sanctionsHit: false,
      amount: Money.fromMinorUnits(100_000n, 'USD'),
      maxAmount: Money.fromMinorUnits(100_000_000n, 'USD'),
      providerAvailable: false,
    });
    assert.equal(selection.chosen, null);
    assert.ok(selection.rejected.some((row) => row.reason === 'provider_unavailable'));
  });
});
