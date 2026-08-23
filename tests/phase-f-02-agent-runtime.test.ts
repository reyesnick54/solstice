import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import { FORBIDDEN_ASSIST_SCOPES } from '../packages/sunrey-agent/src/taxonomy.ts';
import { SUNREY_AGENT_ISOLATION } from '../packages/sunrey-agent/src/isolation.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase F Prompt 2 agent runtime productization', () => {
  it('keeps production disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
  });

  it('extends the canonical Agent owner', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-agent/src/runtime.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-agent/src/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/user-agent-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/agent-execution')), false);
    assert.equal(existsSync(join(ROOT, 'packages/conversation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/memory')), false);
    assert.equal(existsSync(join(ROOT, 'packages/model-gateway')), false);
  });

  it('forbids execution privileges on mandates', () => {
    assert.deepEqual(FORBIDDEN_ASSIST_SCOPES, [
      'DIRECT_LEDGER_WRITE',
      'BYPASS_KERNEL',
      'SELF_APPROVE',
      'MASTER_SIGNING_KEY',
    ]);
    assert.equal(SUNREY_AGENT_ISOLATION.aiIdentityCannotSign, true);
  });

  it('documents the BFF and privacy contract', () => {
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_F_02_AGENT_RUNTIME_MEMORY.md'), 'utf8');
    assert.match(doc, /Agent identity/);
    assert.match(doc, /SAFE_TO_PROCEED_TO_PHASE_F_PROMPT_3=true/);
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.match(doc, /containsConversationContent/);
    const openapi = readFileSync(join(ROOT, 'api/sunrey-consumer-bff-v1.openapi.yaml'), 'utf8');
    assert.match(openapi, /\/api\/v1\/agents/);
    assert.match(openapi, /postAgentMessage/);
  });
});
