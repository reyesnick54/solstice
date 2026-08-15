import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

describe('investment architecture guards', () => {
  it('rejects a second account model, float arithmetic, live broker, and agent/growth auto-trade', () => {
    const investmentFiles = walk(join(ROOT, 'packages/investments/src'));
    for (const file of investmentFiles) {
      if (file.endsWith('.test.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/\bbalance\s*[?:]/.test(source) && /InvestmentAccount/.test(source), false, file);
      assert.equal(/parseFloat\s*\(|\bNumber\s*\(/.test(source), false, file);
      assert.equal(/LIVE_INVESTMENT_EXECUTION\s*=\s*true/.test(source), false, file);
      assert.equal(/\b(SELL_SHORT|LEVERAGED_BUY|MARGIN|OPTION|DERIVATIVE)\b/.test(source) && /enabled:\s*true/.test(source), false, file);
    }
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      if (file.endsWith('isolation.ts') || file.endsWith('.test.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/packages\/investments|PaperBrokerProvider|BrokerExecutionProvider/.test(source), false, file);
    }
    const growth = readFileSync(join(ROOT, 'packages/platform/src/growth/materialize.ts'), 'utf8');
    assert.equal(/kernel\.submit|postJournal|createPaperOrder\(/.test(growth), false);
    assert.equal(/\bpackages\/brokerage\b|\bpackages\/portfolio\b|\bpackages\/trading\b/.test(investmentFiles.join('\n')), false);
  });
});
