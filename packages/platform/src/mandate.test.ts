import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../../agent/src/interpretation.ts';
import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from './mandate/compiler.ts';
import { detectMandateConflicts } from './mandate/conflicts.ts';
import { isHighImpactMandate, recordMandateConfirmation } from './mandate/confirmation.ts';
import { canTransitionMandate, transitionMandate } from './mandate/lifecycle.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('mandate lifecycle', () => {
  it('allows only the documented transitions', () => {
    assert.equal(canTransitionMandate('DRAFT', 'AWAITING_CONFIRMATION'), true);
    assert.equal(canTransitionMandate('AWAITING_CONFIRMATION', 'ACTIVE'), true);
    assert.equal(canTransitionMandate('ACTIVE', 'PAUSED'), true);
    assert.equal(canTransitionMandate('ACTIVE', 'REVOKED'), true);
    assert.equal(canTransitionMandate('REVOKED', 'ACTIVE'), false);
    assert.equal(transitionMandate('ACTIVE', 'DRAFT').ok, false);
  });
});

describe('mandate compiler', () => {
  it('compiles the demo request after deterministic interpretation', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText:
        'Keep at least $8,000 liquid. Build my emergency fund to $20,000. Reduce expensive debt. Do not make high-risk investments. Ask me before any movement over $1,000.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    assert.equal(compiled.value.state, 'DRAFT');
    assert.equal(compiled.value.planningEligible, false);
    assert.ok(compiled.value.hardConstraints.some((item) => item.kind === 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR'));
    assert.ok(compiled.value.softPreferences.some((item) => item.kind === 'PREFER_LIQUIDITY'));
    assert.equal(
      compiled.value.hardConstraints.every((item) => item.overrideForbidden === true),
      true,
    );
  });

  it('detects keep-all-liquid versus invest-all-immediately without choosing', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText: 'Keep all $10,000 liquid and invest all $10,000 immediately.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const conflicts = detectMandateConflicts(draft.hardConstraints);
    assert.ok(conflicts.some((item) => item.code === 'CONTRADICTORY_CONSTRAINTS'));
    const compiled = compileEconomicMandate({ draft, now: NOW });
    assert.equal(compiled.ok, false);
  });

  it('rejects missing goals', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText: 'Hello there.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    assert.equal(compiled.ok, false);
    if (compiled.ok) {
      throw new Error('expected refusal');
    }
    assert.ok(compiled.error.issues.some((item) => item.code === 'MISSING_GOALS'));
  });
});

describe('mandate confirmation', () => {
  it('binds confirmation to ActorContext and refuses unverified actors', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_maya',
      sourceText: 'Keep at least $8,000 liquid and reduce expensive debt.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const refused = recordMandateConfirmation({
      mandate: compiled.value,
      actor: {
        actorId: 'x',
        subjectId: 'id_maya',
        sessionId: 's',
        authenticationAssurance: 'STRONG',
        authorizedCapabilities: [],
        issuedAt: NOW,
        expiresAt: NOW,
        issuer: 'solstice-identity',
        integrity: { algorithm: 'HMAC-SHA256', hex: '00', keyId: 'k', keyVersion: 1 },
      } as never,
      now: NOW,
    });
    assert.equal('ok' in refused && refused.ok === false, true);
  });

  it('records who confirmed, version, timestamp, context, and hash', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_confirm',
        jurisdiction: asJurisdiction('US'),
        identityId: 'id_confirm',
        customerId: asCustomerId('cust_confirm'),
        capabilities: ['CONFIRM_ECONOMIC_MANDATE', 'VIEW_GROWTH_PLAN'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_confirm');
    if (!actor.ok) {
      throw new Error('expected ok');
    }
    const interpretation = interpretMandateLanguage({
      subjectId: actor.value.subjectId,
      sourceText: 'Keep at least $8,000 liquid and reduce expensive debt.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    assert.equal(isHighImpactMandate(compiled.value), false);
    const confirmation = recordMandateConfirmation({
      mandate: compiled.value,
      actor: actor.value,
      now: NOW,
    });
    assert.equal('confirmationId' in confirmation, true);
    if (!('confirmationId' in confirmation)) {
      return;
    }
    assert.equal(confirmation.actorId, actor.value.actorId);
    assert.equal(confirmation.version, compiled.value.version);
    assert.equal(confirmation.confirmedAt, NOW);
    assert.equal(confirmation.contextHash, actor.value.integrity.hex);
    assert.match(confirmation.confirmationHash, /^[0-9a-f]{64}$/);
  });
});
