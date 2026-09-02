import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { subjectRefFor } from '../packages/human-economic-contribution/src/ids.ts';
import { HumanEconomicIdentityService } from '../packages/human-economic-contribution/src/identity/index.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

describe('Wave 6 pseudonymous identity integration', () => {
  it('exports HumanEconomicIdentityService from package index path', () => {
    const svc = new HumanEconomicIdentityService();
    const subjectRef = subjectRefFor('integration');
    const registered = svc.registerIdentity({
      pseudonymousSubjectRef: subjectRef,
      jurisdiction: 'US',
      createdAt: NOW,
    });
    assert.equal(registered.ok, true);
    const facts = svc.factsForContribution(registered.value!.humanActorId);
    assert.ok(facts);
    assert.equal(facts!.pseudonymousSubjectRef, subjectRef);
    assert.equal(facts!.operational, true);
    assert.equal(facts!.identityCommitment.length, 64);
  });
});
