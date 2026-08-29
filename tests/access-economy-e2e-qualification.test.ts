/**
 * ACCESS-13R end-to-end qualification for representative consumer flows.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildIntent,
  createExperienceComposer,
  ExperienceComposer,
  japan14DayTripSpec,
  recurringHouseholdFoodSpec,
} from '../packages/sunrey-access-fabric/src/index.ts';
import { createSandboxAccessEconomy } from '../packages/human-access-economy/src/service.ts';
import { qualifyAccessEconomy } from '../packages/sunrey-economics/src/access-economy/index.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');

describe('ACCESS-13R representative access lifecycles', () => {
  it('Example A — Mustang intent registers canonical domain state in simulation', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    const product = createSandboxAccessEconomy('cust_mustang');
    const created = product.createIntent(
      { actorId: 'actor_mustang', customerId: 'cust_mustang', verified: true, restricted: false },
      {
        idempotencyKey: 'mustang-intent-1',
        category: 'MOBILITY',
        summary: 'Mustang convertible in Miami for two weeks',
        location: 'Miami, FL',
      },
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.productionReady, false);
    assert.equal(created.value.productionActive, false);
    assert.equal(created.value.liveConnectivityEnabled, false);
  });

  it('Example B — Japan 14-day experience completes under ALL_OR_NOTHING with human confirmation', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const composer = new ExperienceComposer({ saga: ports.saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'family-smith',
      request: 'Take my family to Japan for 14 days.',
      scenarioKey: 'japan-14-day',
      now: NOW,
    });
    const { bundle: proposed } = composer.proposeFromIntent({
      intent,
      spec: japan14DayTripSpec(NOW),
    });
    assert.equal(proposed.proposedBy, 'AI');
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-smith' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-smith' });
    assert.equal(result.outcome, 'COMPLETED');
    assert.equal(vault.verifyChain().ok, true);
  });

  it('Example C — recurring household food access remains non-transferable entitlement simulation', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const composer = new ExperienceComposer({ saga: ports.saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'household-food',
      request: 'Maintain our weekly household grocery access.',
      scenarioKey: 'household-food',
      now: NOW,
    });
    const { bundle: proposed } = composer.proposeFromIntent({
      intent,
      spec: recurringHouseholdFoodSpec(NOW),
    });
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'household-food' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'household-food' });
    assert.equal(result.outcome, 'COMPLETED');
    assert.equal(vault.verifyChain().ok, true);
  });

  it('qualification gate remains separate from production activation', () => {
    const report = qualifyAccessEconomy();
    assert.equal(report.qualificationState, 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE');
    assert.equal(report.productionPosture.PRODUCTION_READY, false);
    assert.equal(report.productionPosture.PRODUCTION_ACTIVE, false);
    assert.equal(report.productionPosture.LIVE_CONNECTIVITY_ENABLED, false);
  });
});
