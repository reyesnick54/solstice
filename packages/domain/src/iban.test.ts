import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from './account.ts';
import { asCoordinateId, createSimulatedIbanCoordinate } from './coordinates.ts';
import { isValidIban, parseIban } from './iban.ts';

describe('IBAN infrastructure', () => {
  it('validates ISO 13616 MOD-97 without assigning a live IBAN', () => {
    const parsed = parseIban('GB82WEST12345698765432');
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.countryCode, 'GB');
    }
    assert.equal(isValidIban('GB82WEST12345698765432'), true);
    assert.equal(isValidIban('GB00WEST12345698765432'), false);
  });

  it('assigns only synthetic SIM-prefixed coordinates', () => {
    const created = createSimulatedIbanCoordinate({
      id: asCoordinateId('coord_1'),
      accountId: asAccountId('acct_1'),
      serial: '42',
    });
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.synthetic, true);
    assert.equal(created.value.liveAssignable, false);
    assert.equal(created.value.value.startsWith('SIM-IBAN-XZ'), true);
    assert.ok(created.value.parsedIban);
    assert.equal(created.value.parsedIban.countryCode, 'XZ');
  });
});
