import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ACCOUNTABILITY_POLICY_VERSION,
  FORBIDDEN_ACCOUNTABILITY_TARGETS,
} from './accountability-policy.ts';
import {
  allowsAutomaticPenalty,
  EQUIVOCATION_EVIDENCE_TYPES,
  RESERVED_EVIDENCE_TYPES,
} from './evidence-format.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'target' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.rs')) {
      out.push(full);
    }
  }
  return out;
}

describe('chunk 39 accountability architecture guards', () => {
  it('keeps automatic penalties on cryptographically provable types only', () => {
    assert.deepEqual(EQUIVOCATION_EVIDENCE_TYPES, [
      'DOUBLE_PROPOSAL',
      'DOUBLE_PREVOTE',
      'DOUBLE_PRECOMMIT',
    ]);
    for (const type of EQUIVOCATION_EVIDENCE_TYPES) {
      assert.equal(allowsAutomaticPenalty(type), true);
    }
    for (const type of RESERVED_EVIDENCE_TYPES) {
      assert.equal(allowsAutomaticPenalty(type), false);
    }
    assert.equal(ACCOUNTABILITY_POLICY_VERSION, 1);
  });

  it('forbids customer ledger, Money, coin, MoonRey, and AI punishment in accountability code', () => {
    const files = [
      ...walk(join(ROOT, 'packages/sunrey-chain/src')),
      ...walk(join(ROOT, 'packages/sunrey-chain/node/src')),
    ].filter((file) =>
      /accountability|evidence-format|evidence\.rs|evidence_pool|validators\.rs|consensus_vote/.test(
        file,
      ),
    );
    assert.equal(files.length > 0, true);
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('.rs') && file.includes('tests')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/from ['"].*packages\/ledger/.test(source), false, file);
      assert.equal(/from ['"].*packages\/money/.test(source), false, file);
      assert.equal(/from ['"].*packages\/sunrey-coin/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/class Money\b/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/openai|llm_|ai_decide|prompt\.jail/i.test(source), false, file);
    }
    assert.equal(FORBIDDEN_ACCOUNTABILITY_TARGETS.includes('MoonRey balances'), true);
    assert.equal(existsSync(join(ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(ROOT, 'packages/staking')), false);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunk-39-validator-accountability.md')), true);
  });
});
