import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lintSource } from './linter.ts';

describe('architectural linter rules', () => {
  it('catches Account constructed without ExecutionAuthority', () => {
    const source = `
      const account = openAccount(fields, more);
    `;
    const findings = lintSource('services/accounts/src/evil.ts', source);
    const hit = findings.find((f) => f.rule === 'account-requires-execution-authority');
    assert.ok(hit);
    assert.equal(hit.line, 2);
  });

  it('catches journal written outside authorized path', () => {
    const source = `
      ledger.postJournal(request);
    `;
    const findings = lintSource('services/random/src/evil.ts', source);
    const hit = findings.find((f) => f.rule === 'journal-outside-authorized-path');
    assert.ok(hit);
    assert.equal(hit.line, 2);
  });

  it('catches a balance field on the Account entity', () => {
    const source = `
      export type Account = {
        readonly id: string;
        readonly balance: bigint;
      };
    `;
    const findings = lintSource('packages/domain/src/account.ts', source);
    const hit = findings.find((f) => f.rule === 'no-balance-on-account');
    assert.ok(hit);
    assert.equal(hit.line, 4);
  });

  it('catches yield identifier on the balance path', () => {
    const source = `
      export const annualYield = 5;
    `;
    const findings = lintSource('services/accounts/src/balances.ts', source);
    const hit = findings.find((f) => f.rule === 'no-blended-return-percentage');
    assert.ok(hit);
    assert.equal(hit.line, 2);
  });

  it('catches floating-point arithmetic in a money path', () => {
    const source = `
      const x = 1.5 * amount;
    `;
    const findings = lintSource('packages/money/src/money.ts', source);
    const hit = findings.find((f) => f.rule === 'no-float-in-money-path');
    assert.ok(hit);
    assert.equal(hit.line, 2);
  });

  it('writes a violating snippet, catches file and line, then deletes it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-linter-'));
    const file = join(dir, 'snippet.ts');
    writeFileSync(file, 'export function bad() {\n  const annualYield = 1;\n}\n');
    const source = readFileSync(file, 'utf8');
    const findings = lintSource('services/accounts/src/balances.ts', source);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((f) => f.rule === 'no-blended-return-percentage');
    assert.ok(hit);
    assert.equal(hit.line, 2);
  });
});
