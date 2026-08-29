import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  buildIntent,
  createExperienceComposer,
  ExperienceComposer,
  japan14DayTripSpec,
  miamiWeekendMobilitySpec,
  proposeComposition,
  recurringHouseholdFoodSpec,
  SimulationCapacityProvider,
} from './index.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');

describe('ExperienceComposer', () => {
  it('AI proposes composition but cannot execute without human confirmation', async () => {
    const { ports } = createExperienceComposer(NOW);
    const composer = new ExperienceComposer({ saga: ports.saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'family-smith',
      request: 'Take my family to Japan for 14 days.',
      scenarioKey: 'japan-14-day',
      now: NOW,
    });
    const { proposal, bundle } = composer.proposeFromIntent({
      intent,
      spec: japan14DayTripSpec(NOW),
    });
    assert.equal(proposal.proposedBy, 'AI');
    assert.equal(bundle.completionState, 'PROPOSED');
    assert.equal(bundle.components.length, 7);
    assert.ok(bundle.totalConsideration.minorUnits > 0n);
    const auth = new (await import('./ports/authorization.ts')).SimulationBundleAuthorization(
      (ports.saga as unknown as { vault: { seal: (k: string, p: unknown) => { evidenceId: string } } }).vault,
    );
    const refused = auth.authorizeBundle({ bundle, confirmedBy: 'ai-agent', humanApproved: false });
    assert.equal(refused.ok, false);
    if (refused.ok) throw new Error('expected refusal');
    assert.match(refused.detail, /human approval/i);
  });

  it('rejects AI self-confirmation path', async () => {
    const { ports } = createExperienceComposer(NOW);
    const composer = new ExperienceComposer({ saga: ports.saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'family-smith',
      request: 'Take my family to Japan for 14 days.',
      scenarioKey: 'japan-14-day',
      now: NOW,
    });
    const { bundle } = composer.proposeFromIntent({ intent, spec: japan14DayTripSpec(NOW) });
    const result = await composer.execute({ bundle, confirmedBy: 'ai-agent' });
    assert.equal(result.outcome, 'FAILED');
  });
});

describe('ALL_OR_NOTHING — Japan 14-day trip', () => {
  it('completes full family bundle with evidence chain', async () => {
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
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-smith' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-smith' });
    assert.equal(result.outcome, 'COMPLETED');
    assert.equal(result.bundle.completionState, 'COMPLETED');
    assert.ok(result.bundle.authorizationEvidenceId);
    const mandatory = result.bundle.components.filter((c) => c.mandatory === 'MANDATORY');
    assert.ok(mandatory.every((c) => c.state === 'COMMITTED'));
    assert.ok(result.bundle.workflowEvidenceIds.length >= mandatory.length);
    assert.equal(vault.verifyChain().ok, true);
    const orphanedCharges = result.bundle.components.filter(
      (c) => c.state === 'FAILED' && c.reservation?.state === 'COMMITTED',
    );
    assert.equal(orphanedCharges.length, 0);
  });

  it('releases holds and fails closed when mandatory component unavailable', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const failing = new SimulationCapacityProvider({
      capabilities: [],
      now: () => NOW,
      failProviderIds: new Set(['sim-travel-japan']),
    });
    const saga = new (await import('./orchestration/saga.ts')).ExperienceBundleSaga({
      capacity: failing,
      authorization: new (await import('./ports/authorization.ts')).SimulationBundleAuthorization(vault),
      vault,
      now: () => NOW,
    });
    const composer = new ExperienceComposer({ saga, now: () => NOW });
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
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-smith' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-smith' });
    assert.equal(result.outcome, 'FAILED');
    assert.equal(result.bundle.completionState, 'FAILED');
    assert.ok(vault.list().some((r) => r.kind === 'access.bundle.compensated' || r.kind === 'access.bundle.authorization.refused' || r.kind.includes('held')));
  });
});

describe('BEST_EFFORT — Miami weekend mobility', () => {
  it('completes with optional components skipped when unavailable', async () => {
    const { ports, vault } = createExperienceComposer(NOW);
    const capacity = new SimulationCapacityProvider({
      capabilities: [
        { providerId: 'sim-mobility-miami', resourceKind: 'MOBILITY', unit: 'ride', availableQuantity: 100, simulationOnly: true },
      ],
      now: () => NOW,
    });
    const saga = new (await import('./orchestration/saga.ts')).ExperienceBundleSaga({
      capacity,
      authorization: new (await import('./ports/authorization.ts')).SimulationBundleAuthorization(vault),
      vault,
      now: () => NOW,
    });
    const composer = new ExperienceComposer({ saga, now: () => NOW });
    const intent = buildIntent({
      subjectRef: 'user-jones',
      request: 'Miami weekend mobility',
      scenarioKey: 'miami-weekend',
      now: NOW,
    });
    const { bundle: proposed } = composer.proposeFromIntent({
      intent,
      spec: miamiWeekendMobilitySpec(NOW),
    });
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-jones' });
    const result = await composer.execute({ bundle: confirmed, confirmedBy: 'user-jones' });
    assert.ok(result.outcome === 'COMPLETED' || result.outcome === 'ADVANCED');
    const mandatory = result.bundle.components.filter((c) => c.mandatory === 'MANDATORY');
    assert.ok(mandatory.every((c) => c.state === 'COMMITTED'));
    assert.ok(result.bundle.alternatives.length > 0);
    assert.equal(vault.verifyChain().ok, true);
  });
});

describe('PARTIAL_WITH_APPROVAL — recurring household food', () => {
  it('waits for partial approval then commits approved components', async () => {
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
    const saga = new (await import('./orchestration/saga.ts')).ExperienceBundleSaga({
      capacity,
      authorization: new (await import('./ports/authorization.ts')).SimulationBundleAuthorization(vault),
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
    const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'user-lee' });
    const reserved = await saga.reserveAll(
      (await saga.authorize({ bundle: confirmed, confirmedBy: 'user-lee' })).bundle,
    );
    assert.equal(reserved.outcome, 'WAITING_APPROVAL');
    const heldIds = reserved.bundle.components
      .filter((c) => c.state === 'HELD')
      .map((c) => c.componentId);
    const partial = await composer.approvePartial({
      bundle: reserved.bundle,
      approvedBy: 'user-lee',
      approvedComponentIds: heldIds,
    });
    assert.equal(partial.outcome, 'COMPLETED');
    assert.ok(partial.bundle.components.some((c) => c.state === 'COMMITTED'));
    assert.ok(partial.bundle.components.some((c) => c.state === 'SKIPPED'));
    assert.equal(vault.verifyChain().ok, true);
  });
});

describe('composition model', () => {
  it('includes dependencies, alternatives, and quote validity', () => {
    const spec = japan14DayTripSpec(NOW);
    const intent = buildIntent({
      subjectRef: 'family-smith',
      request: 'Japan trip',
      scenarioKey: 'japan-14-day',
      now: NOW,
    });
    const proposal = proposeComposition({ intent, spec, now: NOW });
    assert.equal(proposal.spec.failurePolicy, 'ALL_OR_NOTHING');
    assert.ok(spec.components.some((c) => c.dependsOn && c.dependsOn.length > 0));
    assert.ok((spec.alternatives ?? []).length > 0);
    assert.equal(spec.quoteValidHours, 48);
  });
});
