import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../domain/src/customer.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asAccountId } from '../../domain/src/account.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import { SimulationBeneficiaryValidator } from './beneficiary-validation.ts';
import { SimulationScreeningAdapter, beneficiaryStatusFromScreening } from './screening.ts';

describe('beneficiary validation and screening', () => {
  const validator = new SimulationBeneficiaryValidator();
  const owner = asCustomerId('cust_us');

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      beneficiaryId: 'ben_1',
      ownerId: owner,
      accountId: asAccountId('acct_1'),
      kind: 'PERSON' as const,
      destinationCountry: 'SA',
      currency: asCurrencyCode('SAR'),
      legalName: 'Ahmed Ali',
      accountCoordinate: { scheme: 'SA_IBAN', value: 'SA0380000000608010167519' },
      ...overrides,
    };
  }

  it('accepts a Saudi IBAN and stores only a hash plus last4', () => {
    const result = validator.validate(payload(), owner);
    assert.equal(isOk(result), true);
    if (!isOk(result)) {
      return;
    }
    assert.equal(result.value.scheme, 'SA_IBAN');
    assert.equal(result.value.displayHint, '7519');
    assert.equal(result.value.coordinateRef.includes('SA038'), false);
    assert.match(result.value.coordinateRef, /^[0-9a-f]{64}$/);
  });

  it('rejects an unsupported country/currency pair', () => {
    const result = validator.validate(payload({ destinationCountry: 'XX', currency: asCurrencyCode('USD') }), owner);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'BENEFICIARY_COUNTRY_CURRENCY_UNSUPPORTED');
    }
  });

  it('rejects an ownership mismatch', () => {
    const result = validator.validate(payload(), asCustomerId('other'));
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'BENEFICIARY_OWNERSHIP_MISMATCH');
    }
  });

  it('does not clear a beneficiary because a customer was already screened', () => {
    const screening = new SimulationScreeningAdapter();
    const hit = screening.screen({
      legalName: 'SANCTIONED PERSON',
      destinationCountry: 'SA',
      coordinateRef: 'abc',
      kind: 'PERSON',
    });
    assert.equal(hit.sanctionsHit, true);
    assert.equal(beneficiaryStatusFromScreening(hit), 'BLOCKED');
    const pep = screening.screen({
      legalName: 'PEP PERSON',
      destinationCountry: 'SA',
      coordinateRef: 'abc',
      kind: 'PERSON',
    });
    assert.equal(pep.pepHit, true);
    assert.equal(beneficiaryStatusFromScreening(pep), 'REVIEW');
  });
});
