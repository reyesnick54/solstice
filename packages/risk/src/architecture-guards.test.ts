import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('risk architecture guards', () => {
  it('rejects Execution Authority, journals, a second Kernel Risk proof, float money, and live trading', () => {
    const files = walk(join(ROOT, 'packages/risk/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer|issue\(/.test(source) && /ExecutionAuthority/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/parseFloat\s*\(|\bNumber\s*\(/.test(source), false, file);
      assert.equal(/LIVE_INVESTMENT_EXECUTION\s*=\s*true/.test(source), false, file);
      assert.equal(/proof:\s*'RISK'/.test(source), false, file);
    }
    const kernel = readFileSync(join(ROOT, 'packages/kernel/src/proofs.ts'), 'utf8');
    assert.equal((kernel.match(/export const riskProof/g) ?? []).length, 1);
    assert.equal(existsSync(join(ROOT, 'packages/investment-risk')), false);
    assert.equal(existsSync(join(ROOT, 'packages/risk-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/portfolio-risk')), false);
  });
});
