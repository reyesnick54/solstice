import { sha256Hex } from '../../security/src/hash.ts';
import { asScreeningRef, type ScreeningRef } from './ids.ts';

export type ScreeningHit = {
  readonly sanctionsHit: boolean;
  readonly pepHit: boolean;
  readonly fraudHold: boolean;
  readonly screeningRef: ScreeningRef;
  readonly status: 'CLEAR' | 'PEP' | 'SANCTIONED' | 'FRAUD';
};

export type ScreeningSubject = {
  readonly legalName: string;
  readonly destinationCountry: string;
  readonly coordinateRef: string;
  readonly kind: 'PERSON' | 'BUSINESS';
};

export type ScreeningPort = {
  screen(subject: ScreeningSubject): ScreeningHit;
};

const SANCTIONED_NAMES = new Set(['SANCTIONED PERSON', 'SANCTIONED BUSINESS']);
const PEP_NAMES = new Set(['PEP PERSON', 'PEP BUSINESS']);
const FRAUD_NAMES = new Set(['FRAUD SIGNAL']);

/**
 * In-process simulation screening. Not a live sanctions/PEP/fraud vendor.
 * A previously screened customer does not clear a new beneficiary.
 */
export class SimulationScreeningAdapter implements ScreeningPort {
  screen(subject: ScreeningSubject): ScreeningHit {
    const name = subject.legalName.trim().toUpperCase();
    const sanctionsHit = SANCTIONED_NAMES.has(name);
    const pepHit = PEP_NAMES.has(name);
    const fraudHold = FRAUD_NAMES.has(name) || subject.coordinateRef.endsWith('fraud');
    const status = sanctionsHit
      ? 'SANCTIONED'
      : fraudHold
        ? 'FRAUD'
        : pepHit
          ? 'PEP'
          : 'CLEAR';
    return Object.freeze({
      sanctionsHit,
      pepHit,
      fraudHold,
      status,
      screeningRef: asScreeningRef(`scr_${sha256Hex(`${name}|${subject.coordinateRef}`).slice(0, 16)}`),
    });
  }
}

export function beneficiaryStatusFromScreening(
  hit: ScreeningHit,
): 'ACTIVE' | 'REVIEW' | 'BLOCKED' {
  if (hit.sanctionsHit || hit.fraudHold) {
    return 'BLOCKED';
  }
  if (hit.pepHit) {
    return 'REVIEW';
  }
  return 'ACTIVE';
}
