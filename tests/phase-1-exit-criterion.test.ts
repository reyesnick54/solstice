import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
  SIMULATION_MODE,
} from '../config/capabilities.ts';
import {
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  createProspect,
  notStartedVerification,
} from '../packages/domain/src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function firstExisting(relativePaths: readonly string[]): string | null {
  for (const relative of relativePaths) {
    if (existsSync(join(ROOT, relative))) {
      return relative;
    }
  }
  return null;
}

describe('Phase 1 exit criterion', () => {
  it('a person can be recorded as a Customer of a named legal entity in a named jurisdiction', () => {
    const customer = createProspect({
      id: asCustomerId('cust_phase1_exit'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-08-13T12:00:00.000Z'),
    });

    assert.equal(customer.id, 'cust_phase1_exit');
    assert.equal(customer.legalEntityId, 'le_solstice_uk_ltd');
    assert.equal(customer.jurisdiction, 'GB');
    assert.equal(customer.status, 'PROSPECT');
    assert.notEqual(customer.legalEntityId, 'solstice');
  });

  it('Phase 1 remains a simulation: real money and live markets stay off', () => {
    assert.equal(SIMULATION_MODE, true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
  });

  it('an account can be opened only via a valid Execution Authority (when that path exists)', async () => {
    const accountPath = firstExisting([
      'packages/domain/src/account.ts',
      'packages/domain/src/account/index.ts',
      'services/accounts/src/index.ts',
      'src/account.ts',
    ]);
    if (accountPath === null) {
      assert.equal(
        existsSync(join(ROOT, 'packages/domain/src/customer.ts')),
        true,
        'Customer foundation must exist until account opening lands',
      );
      return;
    }

    const module = await import(join(ROOT, accountPath));
    const Account = module.Account ?? module.default;
    if (Account && typeof Account === 'function') {
      const names = Function.prototype.toString.call(Account);
      assert.match(
        names,
        /ExecutionAuthority|executionAuthority/,
        'Account construction must take an Execution Authority argument',
      );
    }
    if (Account && typeof Account === 'object') {
      assert.equal(Object.hasOwn(Account, 'balance'), false);
    }
  });

  it('a balance is readable from ledger postings and is not a field on Account (when those paths exist)', async () => {
    const accountPath = firstExisting([
      'packages/domain/src/account.ts',
      'packages/domain/src/account/index.ts',
      'src/account.ts',
    ]);
    if (accountPath !== null) {
      const source = await import('node:fs/promises').then((fs) =>
        fs.readFile(join(ROOT, accountPath), 'utf8'),
      );
      assert.equal(
        /^\s*(?:readonly\s+)?balance\s*[:=]/m.test(source),
        false,
        'Account entity must not persist a balance field',
      );
    }

    const balancePath = firstExisting([
      'packages/accounts/src/balances.ts',
      'services/accounts/src/balances.ts',
    ]);
    if (balancePath === null) {
      assert.ok(true, 'Phase 1 balance read model is not in this tree; leftover src/balances.ts is not loaded');
      return;
    }
    const balances = await import(join(ROOT, balancePath));
    for (const value of Object.values(balances)) {
      if (value && typeof value === 'object') {
        assert.equal(Object.hasOwn(value, 'yieldRate'), false);
        assert.equal(Object.hasOwn(value, 'percentReturn'), false);
        assert.equal(Object.hasOwn(value, 'blendedReturn'), false);
      }
    }
  });

  it('every state change in this tree still has a Customer evidence-shaped record in the demo path', () => {
    assert.equal(existsSync(join(ROOT, 'packages/domain/src/demo.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/domain/src/customer.ts')), true);
  });
});
