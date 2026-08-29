import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildIntent,
  createExperienceComposer,
  ExperienceComposer,
  japan14DayTripSpec,
  miamiWeekendMobilitySpec,
  recurringHouseholdFoodSpec,
  SimulationCapacityProvider,
} from '../packages/sunrey-access-fabric/src/index.ts';
import { ExperienceBundleSaga } from '../packages/sunrey-access-fabric/src/orchestration/saga.ts';
import { SimulationBundleAuthorization } from '../packages/sunrey-access-fabric/src/ports/authorization.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');

describe('ACCESS-10 experience composer E2E simulation', () => {
  it('runs Japan 14-day family trip under ALL_OR_NOTHING', async () => {
    assert.equal(ENVIRONMENT, 'simulation');
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
    assert.equal(proposed.failurePolicy, 'ALL_OR_NOTHING');
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-smith' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-smith' });
    assert.equal(result.outcome, 'COMPLETED');
    assert.equal(result.bundle.completionState, 'COMPLETED');
    assert.ok(result.bundle.components.some((c) => c.label.includes('room')));
    assert.ok(result.bundle.components.some((c) => c.label.includes('Outbound')));
    assert.equal(vault.verifyChain().ok, true);
  });

  it('runs Miami weekend mobility under BEST_EFFORT', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const composer = new ExperienceComposer({ saga: ports.saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'user-jones',
      request: 'Miami weekend mobility bundle',
      scenarioKey: 'miami-weekend',
      now: NOW,
    });
    const { bundle: proposed } = composer.proposeFromIntent({
      intent,
      spec: miamiWeekendMobilitySpec(NOW),
    });
    assert.equal(proposed.failurePolicy, 'BEST_EFFORT');
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-jones' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-jones' });
    assert.equal(result.outcome, 'COMPLETED');
    assert.ok(result.bundle.components.filter((c) => c.mandatory === 'MANDATORY').every((c) => c.state === 'COMMITTED'));
    assert.equal(vault.verifyChain().ok, true);
  });

  it('runs recurring household food-access under PARTIAL_WITH_APPROVAL', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const capacity = new SimulationCapacityProvider({
      capabilities: [
        {
          providerId: 'sim-food-household',
          resourceKind: 'RECURRING_SUBSCRIPTION',
          unit: 'delivery_week',
          availableQuantity: 4,
          simulationOnly: true,
        },
      ],
      now: () => NOW,
    });
    const saga = new ExperienceBundleSaga({
      capacity,
      authorization: new SimulationBundleAuthorization(vault),
      vault,
      now: () => NOW,
    });
    const composer = new ExperienceComposer({ saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'household-lee',
      request: 'Recurring household food-access bundle',
      scenarioKey: 'household-food',
      now: NOW,
    });
    const { bundle: proposed } = composer.proposeFromIntent({
      intent,
      spec: recurringHouseholdFoodSpec(NOW),
    });
    assert.equal(proposed.failurePolicy, 'PARTIAL_WITH_APPROVAL');
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-lee' });
    const auth = saga.authorize({ bundle: confirmed, confirmedBy: 'user-lee' });
    assert.equal(auth.outcome, 'ADVANCED');
    const reserved = await saga.reserveAll(auth.bundle);
    assert.equal(reserved.outcome, 'WAITING_APPROVAL');
    const heldIds = reserved.bundle.components.filter((c) => c.state === 'HELD').map((c) => c.componentId);
    const final = await composer.approvePartial({
      bundle: reserved.bundle,
      approvedBy: 'user-lee',
      approvedComponentIds: heldIds,
    });
    assert.equal(final.outcome, 'COMPLETED');
    assert.equal(vault.verifyChain().ok, true);
  });
});
