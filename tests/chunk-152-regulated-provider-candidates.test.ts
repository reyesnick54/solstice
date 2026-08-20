import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../packages/config/src/flags.ts';
import { createFixtureIdentityProviderPorts } from '../packages/identity/src/provider-candidate/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { createFixtureComplianceProviderPorts } from '../packages/kernel/src/compliance/provider-candidate/index.ts';
import { FixtureTravelRuleCandidate } from '../packages/custody/src/provider-candidate/index.ts';
import { FixtureSurveillanceProvider } from '../packages/market-surveillance/src/provider-candidate/index.ts';

const NOW = asUtcInstant('2026-08-20T12:00:00.000Z');

describe('Chunk 152 regulated provider candidates', () => {
  it('ships under existing owners and forbids competing packages', () => {
    assert.equal(existsSync('docs/architecture/chunks/chunk-152.json'), true);
    assert.equal(existsSync('docs/compliance/chunk-152-regulated-provider-candidates.md'), true);
    assert.equal(existsSync('packages/identity/src/provider-candidate/index.ts'), true);
    assert.equal(existsSync('packages/kernel/src/compliance/provider-candidate/index.ts'), true);
    assert.equal(existsSync('packages/custody/src/provider-candidate/index.ts'), true);
    assert.equal(existsSync('packages/market-surveillance/src/provider-candidate/index.ts'), true);
    assert.equal(existsSync('packages/kyc'), false);
    assert.equal(existsSync('packages/aml'), false);
    assert.equal(existsSync('packages/sanctions'), false);
    assert.equal(existsSync('packages/compliance-v2'), false);
    assert.equal(existsSync('packages/regtech'), false);
    assert.equal(existsSync('packages/travel-rule-v2'), false);
    assert.equal(existsSync('packages/surveillance-v2'), false);
  });

  it('31-32. keeps LIVE_EXTERNAL_KYC false and production inactive', () => {
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(ENVIRONMENT, 'simulation');
    const identity = createFixtureIdentityProviderPorts();
    assert.equal(identity.identityVerification.verifyPerson('idn_ok', NOW).outcome, 'VERIFIED');
    const compliance = createFixtureComplianceProviderPorts();
    assert.notEqual(
      compliance.sanctions.screen({
        subjectKind: 'PERSON',
        subjectRef: 'unavailable',
        jurisdiction: 'GB',
        now: NOW,
      }).outcome,
      'CLEAR',
    );
    assert.equal(new FixtureTravelRuleCandidate().travelRuleAckAuthorizesWithdrawal(), false);
    assert.equal(new FixtureSurveillanceProvider().isEnforcementAuthority(), false);
  });

  it('30. makes no real provider calls', () => {
    const identitySource = readFileSync('packages/identity/src/provider-candidate/transport.ts', 'utf8');
    const complianceSource = readFileSync('packages/kernel/src/compliance/provider-candidate/transport.ts', 'utf8');
    const travelSource = readFileSync('packages/custody/src/provider-candidate/transport.ts', 'utf8');
    for (const source of [identitySource, complianceSource, travelSource]) {
      assert.equal(source.includes('fetch('), false);
      assert.equal(source.includes('http.request'), false);
      assert.equal(source.includes('net.connect'), false);
      assert.equal(source.includes("kind: 'FAKE'") || source.includes("readonly kind = 'FAKE'"), true);
    }
  });
});
