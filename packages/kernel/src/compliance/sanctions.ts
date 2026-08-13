import type { Jurisdiction } from '@solstice/domain';
import { ENVIRONMENT, LIVE_FLAGS, assertSimulationOnly } from '../flags.ts';
import type { Posture } from '../posture.ts';

export type SanctionsSubject = {
  readonly role: 'SENDER' | 'RECEIVER' | 'BENEFICIAL_OWNER' | 'DESTINATION_COUNTRY';
  readonly name?: string;
  readonly country?: Jurisdiction | string;
  readonly identifiers?: readonly string[];
};

export type SanctionsHit = {
  readonly list: 'BLOCK' | 'HOLD' | 'REVIEW';
  readonly matchedOn: string;
  readonly subject: SanctionsSubject;
};

export type SanctionsOutcome = {
  readonly outcome: Posture;
  readonly hits: readonly SanctionsHit[];
  readonly screened: readonly SanctionsSubject[];
};

const BLOCK_NAMES = ['BLOCKED PERSON', 'SANCTIONED ENTITY LLC'] as const;
const HOLD_NAMES = ['HOLD PERSON'] as const;
const REVIEW_NAMES = ['REVIEW PERSON'] as const;
const BLOCK_COUNTRIES = ['IR', 'KP', 'SY', 'CU'] as const;

function normalizeName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * In-process sanctions stub. No network. Deterministic list match.
 * LIVE_SANCTIONS stays false; this never calls a real provider.
 */
export function screenSanctions(subjects: readonly SanctionsSubject[]): SanctionsOutcome {
  assertSimulationOnly();
  if (LIVE_FLAGS.LIVE_SANCTIONS !== false || ENVIRONMENT !== 'simulation') {
    throw new Error('LIVE_SANCTIONS must stay false');
  }

  const hits: SanctionsHit[] = [];
  for (const subject of subjects) {
    if (subject.role === 'DESTINATION_COUNTRY' && subject.country) {
      const country = String(subject.country).toUpperCase();
      if ((BLOCK_COUNTRIES as readonly string[]).includes(country)) {
        hits.push({
          list: 'BLOCK',
          matchedOn: `destination_country:${country}`,
          subject,
        });
      }
    }
    if (subject.name) {
      const name = normalizeName(subject.name);
      if ((BLOCK_NAMES as readonly string[]).includes(name)) {
        hits.push({ list: 'BLOCK', matchedOn: `name:${name}`, subject });
      } else if ((HOLD_NAMES as readonly string[]).includes(name)) {
        hits.push({ list: 'HOLD', matchedOn: `name:${name}`, subject });
      } else if ((REVIEW_NAMES as readonly string[]).includes(name)) {
        hits.push({ list: 'REVIEW', matchedOn: `name:${name}`, subject });
      }
    }
  }

  let outcome: Posture = 'CLEAR';
  for (const hit of hits) {
    if (hit.list === 'BLOCK') outcome = 'BLOCK';
    else if (hit.list === 'HOLD' && outcome !== 'BLOCK') outcome = 'HOLD';
    else if (hit.list === 'REVIEW' && outcome === 'CLEAR') outcome = 'REVIEW';
  }

  return Object.freeze({
    outcome,
    hits: Object.freeze(hits.slice()),
    screened: Object.freeze(subjects.slice()),
  });
}
