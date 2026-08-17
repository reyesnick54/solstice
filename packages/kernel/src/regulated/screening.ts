import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  toUnavailable,
  type ProviderScreenResponse,
  type ScreeningRequest,
} from '../compliance/ports.ts';
import type { ScreeningOutcome, ScreeningType } from '../compliance/types.ts';

/**
 * External screening is evidence input, not a legal conclusion.
 * The Compliance Kernel remains the deterministic policy layer.
 */
export type ScreeningEvidenceFact = {
  readonly screeningType: ScreeningType;
  readonly providerRef: string;
  readonly outcome: ScreeningOutcome;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly legalConclusion: false;
  readonly automaticDecision: false;
  readonly observedAt: UtcInstant;
};

export function screeningResponseToFact(
  screeningType: ScreeningType,
  request: ScreeningRequest,
  response: ProviderScreenResponse,
): ScreeningEvidenceFact {
  const normalized = response.available
    ? response
    : toUnavailable(response.providerRef, request.now);
  return Object.freeze({
    screeningType,
    providerRef: normalized.providerRef,
    outcome: normalized.outcome,
    reasonCodes: Object.freeze([...normalized.reasonCodes]),
    evidenceRefs: Object.freeze([...normalized.evidenceRefs]),
    legalConclusion: false,
    automaticDecision: false,
    observedAt: request.now,
  });
}

export function factIsLegalGuilt(_fact: ScreeningEvidenceFact): false {
  return false;
}
