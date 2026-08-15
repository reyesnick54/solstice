import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FORBIDDEN_STRATEGY_STATES, LIVE_STRATEGY_EXECUTION, STRATEGY_LIFECYCLE_STATES } from './types.ts';
import { isForbiddenLiveState, liveStatesPresentIn, LEGAL_STRATEGY_TRANSITIONS } from './lifecycle.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
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

describe('strategy-lab architecture guards', () => {
  it('rejects arbitrary code, live states, direct broker/ledger/authority, and competing packages', () => {
    const files = walk(join(ROOT, 'packages/strategy-lab/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/\beval\s*\(|new Function\s*\(/.test(source), false, file);
      assert.equal(/child_process|node:child_process/.test(source), false, file);
      assert.equal(/AuthorityIssuer|issueExecutionAuthority/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/PaperBrokerProvider/.test(source), false, file);
      assert.equal(/LIVE_STRATEGY_EXECUTION\s*=\s*true/.test(source), false, file);
      assert.equal(/LIVE_APPROVED|LIVE_RUNNING/.test(source) && !file.endsWith('types.ts') && !file.endsWith('lifecycle.ts'), false, file);
    }
    assert.equal(LIVE_STRATEGY_EXECUTION, false);
    assert.equal(STRATEGY_LIFECYCLE_STATES.includes('LIVE_APPROVED' as never), false);
    assert.equal(liveStatesPresentIn([...STRATEGY_LIFECYCLE_STATES, ...FORBIDDEN_STRATEGY_STATES]).length > 0, true);
    assert.equal(isForbiddenLiveState('LIVE_APPROVED'), true);
    for (const [from, tos] of Object.entries(LEGAL_STRATEGY_TRANSITIONS)) {
      assert.equal(tos.some((to) => to.startsWith('LIVE')), false, from);
    }
    assert.equal(existsSync(join(ROOT, 'packages/backtest')), false);
    assert.equal(existsSync(join(ROOT, 'packages/trading-lab')), false);
    assert.equal(existsSync(join(ROOT, 'packages/quant')), false);
    assert.equal(existsSync(join(ROOT, 'packages/strategy-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/algo-trading')), false);
    assert.equal(existsSync(join(ROOT, 'packages/strategy-lab')), true);
    assert.equal(existsSync(join(ROOT, 'services/strategy-lab')), true);
  });
});
