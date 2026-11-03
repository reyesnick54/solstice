import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSecCorporateEntity } from '../entities/sec-corporate.ts';
import { createAafRevisionLedger } from './ledger.ts';

describe('AAF revision ledger', () => {
  it('resolves CIK to canonical entity id', () => {
    const resolved = resolveSecCorporateEntity({ cik: '999999', ticker: 'SIMC' });
    assert.equal(resolved.canonicalEntityId, 'sunrey:company:us:0000999999');
  });

  it('rejects duplicate filing ids (append-only)', () => {
    const ledger = createAafRevisionLedger();
    ledger.append({
      filingId: 'f1',
      rootFilingId: 'f1',
      knowableAtUtc: '2024-01-01T00:00:00.000Z',
      amendmentKind: 'original',
      evidenceRef: 'sec-edgar:test',
      payloadMaterial: ['f1'],
    });
    assert.throws(() =>
      ledger.append({
        filingId: 'f1',
        rootFilingId: 'f1',
        knowableAtUtc: '2024-02-01T00:00:00.000Z',
        amendmentKind: 'restatement',
        evidenceRef: 'sec-edgar:test2',
        payloadMaterial: ['f1'],
      }),
    );
  });
});
