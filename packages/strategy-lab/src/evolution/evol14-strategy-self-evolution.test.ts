/**
 * HELIOS EVOL14 — Strategy Genome self-evolution qualification (critical overfit vs robust test).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import { LIVE_TRADING_ENABLED } from '@solstice/config';

import {
  HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED,
  evaluateStrategyGenomeSelfEvolutionQualification,
} from './qualification.ts';
import { runStrategyEvolutionSimulation } from './simulation.ts';

describe('HELIOS EVOL14 — Strategy Genome self-evolution', () => {
  it('rejects flashy overfit candidate while preferring moderate robust genome', () => {
    const sim = runStrategyEvolutionSimulation({
      evaluatedAt: asUtcInstant('2026-11-06T12:00:00.000Z'),
      gitSha: 'a'.repeat(40),
    });
    assert.equal(sim.overfitCandidateRejected, true);
    assert.ok(sim.overfitRejectionReasons.length >= 1);
    assert.equal(sim.moderateCandidatePreferred, true);
    assert.equal(sim.championComparison.promotionJustified, true);
    assert.equal(sim.holdoutDegradationDetected, true);
  });

  it('records an evidence trail and trial ledger', () => {
    const sim = runStrategyEvolutionSimulation({
      evaluatedAt: asUtcInstant('2026-11-06T12:00:00.000Z'),
      gitSha: 'f'.repeat(40),
    });
    assert.ok(sim.sealedEvidenceTrail.length >= 1);
    assert.ok(sim.trials.length >= 10);
    assert.ok(sim.trialSuccessCount + sim.trialFailureCount === sim.trials.length);
  });

  it('emits HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED when live trading is disabled and simulation invariants hold', () => {
    assert.equal(LIVE_TRADING_ENABLED, false);
    const result = evaluateStrategyGenomeSelfEvolutionQualification({
      evaluatedAt: asUtcInstant('2026-11-06T12:00:00.000Z'),
      gitSha: 'b'.repeat(40),
    });
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED);
    assert.equal(result.blockers.length, 0);
  });
});
