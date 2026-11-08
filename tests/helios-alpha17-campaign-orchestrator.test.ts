/**
 * HELIOS FORWARD ALPHA — ALPHA17 autonomous forward campaign orchestrator.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ForwardCampaignOrchestrator,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
  buildSimulationCampaignRuntimePorts,
  evaluateAlpha17CampaignOrchestratorQualification,
  sampleAlpha17CampaignId,
} from '../packages/strategy-lab/src/forward-alpha/campaign-orchestrator/index.ts';
import { ProactiveForwardCampaignCoordinator } from '../packages/platform/src/helios/research-monitor/proactive/campaign-orchestrator-bridge.ts';

const ROOT = join(import.meta.dirname, '..');
const T0 = asUtcInstant('2026-01-15T14:00:00.000Z');
const OWNER = 'runtime-owner-a';

describe('HELIOS ALPHA17 forward campaign orchestrator', () => {
  it('exports qualification marker HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED', () => {
    assert.equal(
      HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
      'HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED',
    );
  });

  it('qualifies engineering layout when modules and test are present', () => {
    const q = evaluateAlpha17CampaignOrchestratorQualification({
      root: ROOT,
      gitSha: 'alpha17-test',
      evaluatedAt: T0,
    });
    assert.equal(q.marker, HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED);
    assert.equal(q.qualified, true);
  });

  it('runs event-driven loop with lease fencing and checkpoint restart safety', () => {
    const clock = new FrozenClock(T0);
    const orchestrator = new ForwardCampaignOrchestrator({
      clock,
      runtime: buildSimulationCampaignRuntimePorts(),
      outcomeHorizonMs: 1,
      defaultLeaseMs: 60_000,
    });
    const campaignId = sampleAlpha17CampaignId('loop');
    orchestrator.registerCampaign({ campaignId, evidenceLane: 'FORWARD_PAPER' });
    orchestrator.armCampaign(campaignId);
    orchestrator.startCampaign(campaignId);

    const claimed = orchestrator.claimCampaign({ campaignId, ownerId: OWNER });
    assert.ok(!('code' in claimed));

    orchestrator.enqueueTrigger({
      campaignId,
      triggerKind: 'SCHEDULED_EVALUATION',
      boundaryKey: 'bk:first',
    });
    const firstPass = orchestrator.drainDueWork({ ownerId: OWNER, limit: 4 });
    assert.equal(firstPass.length, 1);
    assert.ok(firstPass[0]!.ok);
    assert.equal(firstPass[0]!.value.newDecisionsSealed, 1);
    assert.ok(firstPass[0]!.value.checkpoint);

    orchestrator.enqueueTrigger({
      campaignId,
      triggerKind: 'SCHEDULED_EVALUATION',
      boundaryKey: 'bk:first',
    });
    const replay = orchestrator.drainDueWork({ ownerId: OWNER, limit: 4 });
    assert.equal(replay.length, 1);
    assert.ok(replay[0]!.ok);
    assert.equal(replay[0]!.value.newDecisionsSealed, 0);

    const snap = orchestrator.exportSnapshot();
    const restarted = new ForwardCampaignOrchestrator({
      clock,
      runtime: buildSimulationCampaignRuntimePorts(),
      outcomeHorizonMs: 1,
    });
    restarted.loadSnapshot(snap);
    const recovered = restarted.recoverFromLatestCheckpoint(campaignId);
    assert.ok(!('code' in recovered));
    assert.equal(recovered.runState, 'RECOVERING');
  });

  it('rejects concurrent owners via lease generation fencing', () => {
    const clock = new FrozenClock(T0);
    const orchestrator = new ForwardCampaignOrchestrator({
      clock,
      runtime: buildSimulationCampaignRuntimePorts(),
    });
    const campaignId = sampleAlpha17CampaignId('lease');
    orchestrator.registerCampaign({ campaignId, evidenceLane: 'FORWARD_SHADOW' });
    orchestrator.armCampaign(campaignId);
    orchestrator.startCampaign(campaignId);
    const a = orchestrator.claimCampaign({ campaignId, ownerId: 'worker-a' });
    assert.ok(!('code' in a));
    const b = orchestrator.claimCampaign({ campaignId, ownerId: 'worker-b' });
    assert.ok('code' in b);
    assert.equal(b.code, 'LEASE_DENIED');
  });

  it('extends proactive scheduler for campaign triggers without a second scheduler', () => {
    const clock = new FrozenClock(T0);
    const coordinator = new ProactiveForwardCampaignCoordinator({
      clock,
      runtime: buildSimulationCampaignRuntimePorts(),
      outcomeHorizonMs: 1,
    });
    const campaignId = sampleAlpha17CampaignId('proactive');
    coordinator.orchestrator.registerCampaign({ campaignId, evidenceLane: 'FORWARD_PAPER' });
    coordinator.orchestrator.armCampaign(campaignId);
    coordinator.orchestrator.startCampaign(campaignId);
    coordinator.orchestrator.claimCampaign({ campaignId, ownerId: OWNER });
    coordinator.bindCampaign({
      campaignId,
      ownerId: OWNER,
      evaluationIntervalMs: 1,
    });
    coordinator.orchestrator.enqueueTrigger({ campaignId, triggerKind: 'EVENT_DRIVEN' });
    clock.advanceMs(5n);
    const tick = coordinator.tickCampaigns({ workLimit: 4 });
    assert.ok(tick.runtimePasses >= 1);
  });
});
