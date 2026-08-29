import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { consumeAuthorizedGraphContext, freezeAccessIntent, validateAccessIntentDraft } from './index.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

const validDraft = {
  intentId: 'axi_id_maya_vehicle',
  subjectId: 'id_maya',
  category: 'VEHICLE_RENTAL',
  kind: 'ONE_TIME',
  experienceLevel: 'ATOMIC',
  target: {
    productType: 'vehicle_rental',
    brandOrModel: 'Mustang',
    attributes: [{ key: 'body_style', value: 'convertible' }],
  },
  geography: { region: 'US', city: 'Miami' },
  window: { durationWeeks: 2 },
  duration: { value: 2, unit: 'WEEK' },
  qualityPreferences: ['convertible'],
  substitutions: { acceptable: true, alternatives: ['similar convertible'] },
  constraints: [{ kind: 'ACCESS_ONLY' }],
  mandateRef: 'mandate_1',
  purpose: 'personal vehicle access',
  consentRefs: ['consent_1'],
  pegContextRefs: ['GOAL:Travel goals'],
  sourceText: 'I want a Mustang convertible in Miami for two weeks.',
  explanation: 'proposal only',
  createdAt: NOW,
};

describe('Access Fabric validation', () => {
  it('validates and freezes a well-formed access intent', () => {
    const validated = validateAccessIntentDraft(validDraft);
    assert.equal(validated.ok, true);
    if (!validated.ok) {
      return;
    }
    const frozen = freezeAccessIntent(validated.value);
    assert.equal(frozen.executable, false);
    assert.equal(frozen.confirmsReservation, false);
    assert.equal(frozen.category, 'VEHICLE_RENTAL');
  });

  it('fails closed on malformed agent output', () => {
    const malformed = validateAccessIntentDraft({ category: 'VEHICLE_RENTAL' });
    assert.equal(malformed.ok, false);
    if (malformed.ok) {
      return;
    }
    assert.equal(malformed.error.code, 'MALFORMED_INTENT');
  });

  it('refuses prohibited graph context consumption', () => {
    const denied = consumeAuthorizedGraphContext({
      slice: {
        authorizedCategories: ['GOAL'],
        categoryLabels: { GOAL: ['Travel goals'] },
        consentRefs: ['consent_1'],
      },
      requestedCategories: ['RISK_PROFILE'],
      requestedLabels: {},
    });
    assert.equal(denied.ok, false);
    if (denied.ok) {
      return;
    }
    assert.equal(denied.error.code, 'PROHIBITED_GRAPH_CONTEXT');
  });
});
