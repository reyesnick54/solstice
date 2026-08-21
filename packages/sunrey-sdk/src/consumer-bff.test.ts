import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONSUMER_ACTIVITY_STATUSES,
  FINANCIAL_ACCOUNT_LIFECYCLES,
  FINANCIAL_PRODUCT_TYPES,
} from './consumer-bff/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('consumer BFF SDK models', () => {
  it('exposes typed account, balance, and activity vocabularies', () => {
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('ACTIVE'));
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('RESTRICTED'));
    assert.ok(FINANCIAL_PRODUCT_TYPES.includes('CHECKING_PAYMENT'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('PENDING'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('COMPLETED'));
    assert.equal(CONSUMER_ACTIVITY_STATUSES.includes('DONE' as never), false);
  });
});

describe('consumer BFF SDK browser boundary', () => {
  it('does not import privileged or Node-only modules', () => {
    const dir = join(here, 'consumer-bff');
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    assert.ok(files.includes('index.ts'));
    const forbidden = [
      'node:http',
      'node:fs',
      'node:net',
      'node:crypto',
      '../gateway/server',
      '../developer-platform',
      '../signer',
      '../../ledger',
      '../../kernel',
      '../../permissions/src/execution-authority',
      '../../persistence',
      'createSimulationKeyProvider',
      'AuthorityIssuer',
      'postJournal',
      'ExecutionAuthority',
    ];
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const needle of forbidden) {
        assert.equal(source.includes(needle), false, `${file} leaked ${needle}`);
      }
    }
  });
});
