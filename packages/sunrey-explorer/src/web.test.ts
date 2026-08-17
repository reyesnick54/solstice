import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const WEB = join(import.meta.dirname, '..', '..', '..', 'apps', 'explorer');

describe('explorer web interface', () => {
  it('ships the functional pages and development network banner', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    const js = readFileSync(join(WEB, 'app.js'), 'utf8');
    assert.equal(existsSync(join(WEB, 'styles.css')), true);
    for (const page of [
      'Home',
      'Blocks',
      'Transactions',
      'Accounts',
      'Assets',
      'Validators',
      'Governance',
      'Oracles',
      'Productive Economy',
      'MoonRey',
      'Machine Economy',
      'Interoperability',
    ]) {
      assert.match(html, new RegExp(page));
    }
    assert.match(html, /DEVELOPMENT/);
    assert.match(html, /not market capitalization/);
    assert.match(html, /not real-value production/);
    assert.doesNotMatch(html, /MAINNET/);
    assert.match(js, /EventSource/);
    assert.match(js, /\/v1\/events/);
    assert.match(js, /indexed_finalized_height/);
  });
});
