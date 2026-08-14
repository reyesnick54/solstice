import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SCANNER = join(import.meta.dirname, '../scripts/secret-scan.py');

describe('secret scanner', () => {
  it('self-test catches representative assembled fixtures', () => {
    const result = spawnSync('python3', [SCANNER, '--self-test'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /self-test: ok/);
  });

  it('fails a temporary tree that contains representative fake credentials', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-secret-scan-'));
    mkdirSync(join(dir, 'leak'));
    writeFileSync(join(dir, 'leak', 'aws.env'), `AWS_ACCESS_KEY_ID=${'AKIA'}${'EXAMPLEKEY000000'}\n`);
    writeFileSync(join(dir, 'leak', 'token.env'), `GH_TOKEN=${'ghp_'}${'y'.repeat(36)}\n`);
    const result = spawnSync('python3', [SCANNER, '--root', dir], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AWS access key/);
    assert.match(result.stderr, /GitHub token/);
  });
});
