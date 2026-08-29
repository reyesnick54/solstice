import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import {
  compareAccessAlternatives,
  composeAccessIntentFromRequest,
  parseAgentAccessIntentDraft,
} from './access-intent.ts';
import { freezeAgentPorts } from './ports.ts';
import { PersonalEconomyAgent } from './service.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function basePorts() {
  return freezeAgentPorts({
    context: {
      subjectId: 'id_maya',
      generatedAt: NOW,
      writePath: false,
      liquidMinorUnitsByCurrency: { USD: '500000' },
      incomeLabels: [],
      obligationLabels: [],
      debtLabels: [],
      goalLabels: ['Travel goals'],
      opportunityLabels: [],
    },
    claims: {
      actorId: 'actor_maya',
      subjectId: 'id_maya',
      authorizedCapabilities: ['CREATE_ACCESS_PROPOSAL'],
      mayProposeOnly: true,
      mayExecute: false,
    },
    mandates: [
      {
        mandateId: 'mandate_maya',
        version: 1,
        status: 'ACTIVE',
        hardConstraintSummaries: ['Ask me before any movement over $1,000.'],
        goalSummaries: ['Travel goals'],
        softPreferenceSummaries: ['Family travel'],
      },
    ],
  });
}

function graphSlice() {
  return {
    mandateId: 'mandate_maya',
    purpose: 'AGENT_ANALYSIS' as const,
    authorizedCategories: Object.freeze(['GOAL', 'PREFERENCE'] as const),
    categoryLabels: Object.freeze({
      GOAL: Object.freeze(['Travel goals']),
      PREFERENCE: Object.freeze(['Family travel']),
    }),
    consentRefs: Object.freeze(['consent_fixture_access']),
  };
}

describe('Personal Economy Agent access intent demand engine', () => {
  it('builds a Mustang rental access intent with governed fields', () => {
    const result = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'I want a Mustang convertible in Miami for two weeks.',
        graphSlice: graphSlice(),
        requestedGraphCategories: ['GOAL'],
        requestedGraphLabels: { GOAL: ['Travel goals'] },
      },
      now: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.category, 'VEHICLE_RENTAL');
    assert.equal(result.value.geography.city, 'Miami');
    assert.equal(result.value.window.durationWeeks, 2);
    assert.equal(result.value.executable, false);
    assert.equal(result.value.confirmsReservation, false);
    assert.ok(result.value.constraints.some((item) => item.kind === 'MANDATE_BOUND'));
    assert.ok(result.value.pegContextRefs.includes('GOAL:Travel goals'));
  });

  it('builds a composite Japan family travel experience intent', () => {
    const result = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'Take my family to Japan for two weeks.',
        graphSlice: graphSlice(),
        requestedGraphCategories: ['PREFERENCE'],
        requestedGraphLabels: { PREFERENCE: ['Family travel'] },
      },
      now: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.category, 'TRAVEL_EXPERIENCE');
    assert.equal(result.value.kind, 'EXPERIENCE_COMPOSITION');
    assert.equal(result.value.experienceLevel, 'COMPOSITE');
    assert.equal(result.value.geography.country, 'JP');
    assert.match(result.value.explanation, /Experience Composer/);
  });

  it('builds recurring grocery access without auto-purchase', () => {
    const result = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'Keep groceries available for our household each week.',
        graphSlice: graphSlice(),
      },
      now: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.category, 'RECURRING_FOOD_ACCESS');
    assert.equal(result.value.kind, 'RECURRING');
    assert.equal(result.value.window.recurrence, 'WEEKLY');
    assert.ok(result.value.constraints.some((item) => item.kind === 'NO_AUTO_PURCHASE'));
  });

  it('denies prohibited graph context and malformed drafts', () => {
    const denied = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'Take my family to Japan for two weeks.',
        graphSlice: graphSlice(),
        requestedGraphCategories: ['RISK_PROFILE'],
        requestedGraphLabels: { RISK_PROFILE: ['High volatility tolerance'] },
      },
      now: NOW,
    });
    assert.equal(denied.ok, false);
    if (denied.ok) {
      return;
    }
    assert.equal(denied.error.code, 'PROHIBITED_GRAPH_CONTEXT');

    const malformed = parseAgentAccessIntentDraft({ category: 'TRAVEL_EXPERIENCE' });
    assert.equal(malformed.ok, false);
  });

  it('requires verified actor context and only returns proposal-only output', () => {
    const clock = new FrozenClock(NOW);
    const agent = new PersonalEconomyAgent({ clock });
    const unverified = agent.proposeAccessIntent({ actorId: 'actor_maya' }, basePorts(), {
      subjectId: 'id_maya',
      sourceText: 'I want a Mustang convertible in Miami for two weeks.',
      graphSlice: graphSlice(),
    });
    assert.equal(unverified.ok, false);
    if (unverified.ok) {
      return;
    }
    assert.equal(unverified.error.code, 'ACTOR_CONTEXT_REQUIRED');

    const proposalOnly = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'I want a Mustang convertible in Miami for two weeks.',
        graphSlice: graphSlice(),
      },
      now: NOW,
    });
    assert.equal(proposalOnly.ok, true);
    if (!proposalOnly.ok) {
      return;
    }
    assert.equal(proposalOnly.value.executable, false);
    assert.equal(proposalOnly.value.confirmsReservation, false);
  });

  it('compares alternatives without executing them', () => {
    const first = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'I want a Mustang convertible in Miami for two weeks.',
        graphSlice: graphSlice(),
      },
      now: NOW,
    });
    const second = composeAccessIntentFromRequest({
      ports: basePorts(),
      request: {
        subjectId: 'id_maya',
        sourceText: 'Keep groceries available for our household each week.',
        graphSlice: graphSlice(),
      },
      now: NOW,
    });
    if (!first.ok || !second.ok) {
      throw new Error('expected composed intents');
    }
    const alternatives = compareAccessAlternatives([first.value, second.value]);
    assert.equal(alternatives.length, 2);
    assert.notEqual(alternatives[0], alternatives[1]);
  });
});
