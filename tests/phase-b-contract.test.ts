import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { CONSUMER_ERROR_CODES } from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { CONSUMER_PLATFORM_ROUTES } from '../services/consumer-platform/src/index.ts';

const require = createRequire(import.meta.url);
const { checkApiSpecs } = require('../scripts/check-api-specs.mjs') as {
  checkApiSpecs: (root: string) => { findings: string[]; files: number };
};

const ROOT = join(import.meta.dirname, '..');
const SPEC = readFileSync(join(ROOT, 'api/sunrey-consumer-platform-v1.openapi.yaml'), 'utf8');

function openApiPaths(text: string): string[] {
  return [...text.matchAll(/^  (\/[^\s:]+):$/gm)].map((match) => match[1] ?? '');
}

describe('Phase B OpenAPI contract', () => {
  it('parses with unique operation IDs and resolved refs', () => {
    const api = checkApiSpecs(ROOT);
    assert.deepEqual(api.findings, []);
    assert.ok(api.files >= 6);
    assert.match(SPEC, /openapi: 3\.1\.0/);
    assert.match(SPEC, /operationId: getConsumerBootstrap/);
    const ids = [...SPEC.matchAll(/operationId:\s+(\S+)/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('documents implemented consumer routes and no fake live money APIs', () => {
    const documented = openApiPaths(SPEC);
    for (const route of CONSUMER_PLATFORM_ROUTES) {
      const path = route.split(' ')[1];
      assert.ok(documented.includes(path ?? ''), route);
    }
    assert.equal(SPEC.includes('LIVE_CONNECTIVITY_ENABLED=true'), false);
    assert.equal(/sk_live_/.test(SPEC), false);
  });

  it('keeps error catalog codes aligned with the OpenAPI enum', () => {
    for (const code of CONSUMER_ERROR_CODES) {
      assert.ok(SPEC.includes(`- ${code}`), code);
    }
  });
});
