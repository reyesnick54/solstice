import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  acceptOperatingScopeFact,
  operatingScopeBlocks,
  operatingScopeIssuesExecutionAuthority,
  type OperatingScopeFact,
} from './operating-scope-fact.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('Kernel operating-scope fact', () => {
  const fact: OperatingScopeFact = Object.freeze({
    schemaVersion: 1,
    jurisdiction: 'XA',
    activationDomain: 'PAYMENT_RAILS',
    legalEntityRef: 'le_sunrey_fixture_xa',
    eligibility: false,
    status: 'RESEARCH_REQUIRED',
    reasonCodes: Object.freeze(['JURISDICTION_RESEARCH_REQUIRED', 'LICENSE_EVIDENCE_MISSING']),
    evidenceReferences: Object.freeze([]),
    productionActive: false,
    issuesExecutionAuthority: false,
    confirmedByCounsel: false,
  });

  it('contains reason codes', () => {
    assert.ok(fact.reasonCodes.includes('LICENSE_EVIDENCE_MISSING'));
    const accepted = acceptOperatingScopeFact(fact);
    assert.deepEqual(accepted.reasonCodes, fact.reasonCodes);
    assert.equal(accepted.eligibility, false);
  });

  it('never issues Execution Authority', () => {
    assert.equal(operatingScopeIssuesExecutionAuthority(fact), false);
    assert.equal(fact.issuesExecutionAuthority, false);
    const source = readFileSync(join(HERE, 'operating-scope-fact.ts'), 'utf8');
    assert.equal(/AuthorityIssuer/.test(source), false);
    assert.equal(/from ['"].*execution-authority/.test(source), false);
  });

  it('blocks unknown or ineligible scope', () => {
    assert.equal(operatingScopeBlocks(fact), true);
  });
});
