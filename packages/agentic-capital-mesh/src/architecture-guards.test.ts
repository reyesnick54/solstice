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

describe('agentic capital mesh architecture guards', () => {
  it('rejects execution, journals, voting authority, live trading, and a second AI runtime', () => {
    const files = walk(join(ROOT, 'packages/agentic-capital-mesh/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      const imports = source
        .split('\n')
        .filter((line) => /^\s*import\s/.test(line))
        .join('\n');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(imports), false, file);
      assert.equal(/createPaperOrder\s*\(/.test(source), false, file);
      assert.equal(/PaperBrokerProvider/.test(imports), false, file);
      assert.equal(/LIVE_INVESTMENT_EXECUTION\s*=\s*true/.test(source), false, file);
      assert.equal(/LIVE_TRADING_ENABLED\s*=\s*true/.test(source), false, file);
      assert.equal(/3\s*\/\s*5/.test(source), false, file);
      assert.equal(/votesFor\s*>\s*votesAgainst/.test(source) && /authorized:\s*true/.test(source), false, file);
      assert.equal(/strategyValidation:\s*'VALIDATED'/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/trading-agents')), false);
    assert.equal(existsSync(join(ROOT, 'packages/investment-agents')), false);
    assert.equal(existsSync(join(ROOT, 'packages/hedge-agent')), false);
    assert.equal(existsSync(join(ROOT, 'packages/capital-ai')), false);
    assert.equal(existsSync(join(ROOT, 'packages/autonomous-trader')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-runtime')), false);
    assert.equal(existsSync(join(ROOT, 'packages/strategy-lab')), false);
  });
});
