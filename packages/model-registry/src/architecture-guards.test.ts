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

describe('model-registry architecture guards', () => {
  it('rejects self-approval, in-place overwrite, live approval, and executable stored code', () => {
    const files = walk(join(ROOT, 'packages/model-registry/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/LIVE_APPROVED/.test(source), false, file);
      assert.equal(/AuthorityIssuer|issueExecutionAuthority|postJournal\(/.test(source), false, file);
      assert.equal(/parseFloat\s*\(/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/models')), false);
    assert.equal(existsSync(join(ROOT, 'packages/model-governance-v2')), false);
  });
});
