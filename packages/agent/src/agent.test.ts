import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { interpretMandateLanguage } from './interpretation.ts';
import { generateCandidateIdeas } from './ideas.ts';
import { explainRisk } from './explain.ts';
import { freezeAgentPorts } from './ports.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Personal Economy Agent interpretation', () => {
  it('maps the demo request into typed fields without treating text as policy', () => {
    const result = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText:
        'Keep at least $8,000 liquid. Build my emergency fund to $20,000. Reduce expensive debt. Do not make high-risk investments. Ask me before any movement over $1,000.',
      now: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.executable, false);
    assert.equal(result.value.modelTextIsPolicy, false);
    assert.ok(result.value.goals.some((goal) => goal.kind === 'MAINTAIN_TARGET_LIQUIDITY'));
    assert.ok(result.value.goals.some((goal) => goal.kind === 'BUILD_EMERGENCY_RESERVE'));
    assert.ok(result.value.goals.some((goal) => goal.kind === 'REDUCE_DEBT'));
    const reserve = result.value.hardConstraints.find((item) => item.kind === 'MINIMUM_CASH_RESERVE');
    assert.equal(reserve?.amount?.minorUnits, '800000');
    const confirm = result.value.hardConstraints.find((item) => item.kind === 'REQUIRED_CONFIRMATION_THRESHOLD');
    assert.equal(confirm?.amount?.minorUnits, '100000');
    assert.ok(result.value.hardConstraints.some((item) => item.kind === 'PROHIBITED_ASSET_CATEGORIES'));
  });

  it('preserves an aggressive short-horizon objective as a goal, not a method', () => {
    const result = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText: 'I want $1,000 to become $1,300 next week.',
      now: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const goal = result.value.goals.find((item) => item.kind === 'AGGRESSIVE_SHORT_HORIZON_GROWTH');
    assert.ok(goal);
    assert.equal(goal?.baseline?.minorUnits, '100000');
    assert.equal(goal?.target?.minorUnits, '130000');
    assert.equal(goal?.timeHorizonDays, 7);
    assert.equal(result.value.executable, false);
  });

  it('emits proposal-only ideas from read-only ports', () => {
    const ports = freezeAgentPorts({
      context: {
        subjectId: 'id_maya',
        generatedAt: NOW,
        writePath: false,
        liquidMinorUnitsByCurrency: { USD: '1200000' },
        incomeLabels: ['Salary'],
        obligationLabels: ['Streaming subscription'],
        debtLabels: ['Card debt'],
        goalLabels: ['Emergency fund'],
        opportunityLabels: [],
      },
      claims: {
        actorId: 'actor_maya',
        subjectId: 'id_maya',
        authorizedCapabilities: ['VIEW_GROWTH_PLAN'],
        mayProposeOnly: true,
        mayExecute: false,
      },
      mandates: [],
    });
    const ideas = generateCandidateIdeas(ports, NOW);
    assert.ok(ideas.every((idea) => idea.executable === false));
    assert.ok(ideas.some((idea) => idea.ideaAction === 'REVIEW_SUBSCRIPTION'));
    assert.ok(ideas.some((idea) => idea.ideaAction === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE'));
  });

  it('explains risk without changing the decision or becoming executable', () => {
    const proposal = explainRisk({
      subjectId: 'id_maya',
      riskSummary: 'Concentration BLOCK on SIM-ETF-1 at 80 percent.',
      now: NOW,
    });
    assert.equal(proposal.kind, 'RISK_EXPLANATION');
    assert.equal(proposal.executable, false);
    assert.match(proposal.rationale, /cannot change the outcome/);
  });
});
