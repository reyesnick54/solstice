import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

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

describe('custody architecture guards', () => {
  it('rejects a second ledger, live provider, private keys, and agent execution', () => {
    const files = walk(join(ROOT, 'packages/custody/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.includes('demo')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/from ['"].*services\//.test(source), false, file);
      assert.equal(/mnemonic|seed phrase|private_key|xprv/i.test(source), false, file);
      assert.equal(/LIVE_APPROVED/.test(source), false, file);
      assert.equal(/licensed exchange|registered VASP|Travel Rule compliant/i.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/custody')), true);
    assert.equal(existsSync(join(ROOT, 'packages/custody-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/custody-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-custody')), false);
    assert.equal(existsSync(join(ROOT, 'packages/institutional-custody-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/hsm-security-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/travel-rule-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/crypto-aml')), false);
    assert.equal(existsSync(join(ROOT, 'packages/travel-rule-production')), false);
    assert.equal(existsSync(join(ROOT, 'packages/custody-activation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-custody')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-custody-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/key-vault')), false);
    assert.equal(existsSync(join(ROOT, 'packages/hsm-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mpc-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/custody-provider-v2')), false);
    const adapter = readFileSync(join(ROOT, 'packages/custody/src/asset-adapter.ts'), 'utf8');
    assert.equal(adapter.includes('lastAssetId'), false);
    const agent = walk(join(ROOT, 'packages/agent/src'));
    for (const file of agent) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('packages/custody'), false, file);
    }
  });
});
