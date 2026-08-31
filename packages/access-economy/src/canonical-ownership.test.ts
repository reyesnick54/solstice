import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ACCESS_ALLOWED_DEPENDENCY_DIRECTIONS,
  ACCESS_CANONICAL_LIFECYCLE,
  ACCESS_CONCEPT_OWNERSHIP,
  ACCESS_DUAL_TOKEN_BOUNDARY,
  ACCESS_FORBIDDEN_COMPETING_PACKAGES,
  ACCESS_HIN_BOUNDARY,
  ACCESS_NAMED_DUPLICATE_TYPES,
  ACCESS_POLICY_COMPLIANCE_BOUNDARY,
} from './canonical-ownership.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Access canonical ownership map', () => {
  it('maps every required domain concept to an existing owner path', () => {
    const required = [
      'accessRequest',
      'accessIntent',
      'eligibility',
      'entitlement',
      'policy',
      'capability',
      'allocation',
      'resourceAvailability',
      'pricingValue',
      'sunReyAllocation',
      'moonReyAllocation',
      'settlement',
      'ledgerEvent',
      'accessIdentity',
      'hinAttribution',
      'providerFulfillment',
      'authorization',
      'expiration',
      'revocation',
      'auditTrail',
    ] as const;

    for (const concept of required) {
      const row = ACCESS_CONCEPT_OWNERSHIP[concept];
      assert.ok(row, `missing ownership for ${concept}`);
      assert.ok(row.owner.startsWith('packages/'), `${concept} owner must be a package path`);
      assert.ok(existsSync(join(ROOT, row.canonicalPath)), `${concept} canonical path must exist`);
    }
  });

  it('forbids competing access-ledger and parallel access packages', () => {
    for (const pkg of ACCESS_FORBIDDEN_COMPETING_PACKAGES) {
      assert.equal(existsSync(join(ROOT, pkg)), false, `${pkg} must not exist`);
    }
  });

  it('keeps canonical domain types exported from access-economy index', () => {
    const index = readFileSync(join(ROOT, 'packages/access-economy/src/index.ts'), 'utf8');
    for (const symbol of ['AccessIntent', 'AccessEntitlement', 'AllocationDecision', 'AccessRight']) {
      assert.match(index, new RegExp(`type ${symbol}`));
    }
    assert.match(index, /canonical-ownership/);
  });

  it('documents intentional duplicate layers without accidental-only types', () => {
    const accidental = ACCESS_NAMED_DUPLICATE_TYPES.filter((row) => row.classification === 'accidental');
    assert.deepEqual(accidental, []);
    const canonicalIntents = ACCESS_NAMED_DUPLICATE_TYPES.filter((row) => row.typeName === 'AccessIntent');
    assert.equal(canonicalIntents.length, 1);
    assert.equal(canonicalIntents[0]?.classification, 'canonical');
  });

  it('defines HIN, dual-token, and policy boundaries', () => {
    assert.equal(ACCESS_HIN_BOUNDARY.hinOwnsIdentity, false);
    assert.equal(ACCESS_HIN_BOUNDARY.hinParticipatesInAllocation, false);
    assert.equal(ACCESS_DUAL_TOKEN_BOUNDARY.financialLedgerMutationOwner, 'packages/ledger');
    assert.equal(ACCESS_POLICY_COMPLIANCE_BOUNDARY.kernelMustNotOwnEconomicAllocation, true);
    assert.equal(existsSync(join(ROOT, ACCESS_HIN_BOUNDARY.contractPath)), true);
  });

  it('lists a complete canonical lifecycle with unique stage owners', () => {
    assert.ok(ACCESS_CANONICAL_LIFECYCLE.length >= 10);
    const stages = ACCESS_CANONICAL_LIFECYCLE.map((row) => row.stage);
    assert.equal(new Set(stages).size, stages.length);
  });

  it('records allowed dependency directions as non-empty guidance', () => {
    assert.ok(ACCESS_ALLOWED_DEPENDENCY_DIRECTIONS.length >= 8);
    for (const edge of ACCESS_ALLOWED_DEPENDENCY_DIRECTIONS) {
      assert.match(edge, /→/);
    }
  });
});
