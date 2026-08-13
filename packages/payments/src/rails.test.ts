import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '@solstice/domain';
import { DomesticRail } from './rails/domestic.ts';
import { InstantRail } from './rails/instant.ts';
import { SepaLikeRail } from './rails/sepa.ts';
import { SwiftLikeRail } from './rails/swift.ts';
import { RAIL_IDS, type PaymentRail, type RailInstruction } from './rails/types.ts';

function instruction(over: Partial<RailInstruction> = {}): RailInstruction {
  return {
    paymentId: 'pay_test',
    sourceCountry: 'US',
    destinationCountry: 'DE',
    currency: 'EUR',
    amount: Money.fromDecimalString('5000.00', 'EUR'),
    debtorName: 'Jane',
    creditorName: 'Ahmed',
    creditorIban: 'DE89370400440532013000',
    creditorBic: 'COBADEFFXXX',
    ...over,
  };
}

function assertAdapter(rail: PaymentRail): void {
  assert.equal(typeof rail.quote, 'function');
  assert.equal(typeof rail.validate, 'function');
  assert.equal(typeof rail.execute, 'function');
  assert.equal(typeof rail.getStatus, 'function');
  assert.ok((RAIL_IDS as readonly string[]).includes(rail.id));
}

describe('PaymentRail adapters', () => {
  it('each adapter conforms to quote/validate/execute/getStatus', () => {
    const rails: PaymentRail[] = [
      new DomesticRail(),
      new SepaLikeRail(),
      new SwiftLikeRail(),
      new InstantRail(),
    ];
    for (const rail of rails) {
      assertAdapter(rail);
    }
  });

  it('domestic is unavailable cross-border and available same-country', () => {
    const rail = new DomesticRail();
    assert.equal(rail.quote(instruction()).available, false);
    const domestic = instruction({
      sourceCountry: 'US',
      destinationCountry: 'US',
      currency: 'USD',
      amount: Money.fromDecimalString('100.00', 'USD'),
    });
    assert.equal(rail.quote(domestic).available, true);
    const executed = rail.execute(domestic);
    assert.equal(executed.accepted, true);
    assert.equal(rail.getStatus(executed.railReference)?.state, 'ACCEPTED');
  });

  it('SEPA-like is EUR/EEA, SWIFT is global, instant is capped', () => {
    const sepa = new SepaLikeRail();
    const swift = new SwiftLikeRail();
    const instant = new InstantRail();
    assert.equal(sepa.quote(instruction()).available, true);
    assert.equal(swift.quote(instruction()).available, true);
    assert.equal(instant.quote(instruction()).available, true);
    assert.equal(
      swift.quote(instruction({ destinationCountry: 'IR' })).available,
      false,
    );
  });
});
