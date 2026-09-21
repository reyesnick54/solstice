/**
 * Event impact objects — directional hypothesis only, not financial authority.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EventImpactSeverity, ImpactDirectionHypothesis, MacroEventModelRoute } from './taxonomy.ts';
import type { EventImpactEvidence, MacroEventArtifact, MacroEventImpact } from './types.ts';
import { isHighImpactDomain } from './calculations.ts';

export function buildEventImpact(input: {
  readonly impactId: string;
  readonly event: MacroEventArtifact;
  readonly directionHypothesis: ImpactDirectionHypothesis;
  readonly uncertainty: string;
  readonly severity?: EventImpactSeverity;
  readonly supportingEvidence: readonly EventImpactEvidence[];
  readonly contradictoryEvidence: readonly EventImpactEvidence[];
  readonly invalidatingConditions: readonly string[];
  readonly modelRoute?: MacroEventModelRoute | null;
  readonly evaluatedAt: UtcInstant;
}): MacroEventImpact {
  const severity = input.severity ?? (isHighImpactDomain(input.event.domain) ? 'HIGH' : 'MEDIUM');

  return Object.freeze({
    impactId: input.impactId,
    eventId: input.event.eventId,
    affectedInstrumentIds: Object.freeze([...input.event.affectedInstrumentIds]),
    affectedAssetClasses: Object.freeze([...input.event.affectedAssetClasses]),
    directionHypothesis: input.directionHypothesis,
    uncertainty: input.uncertainty,
    severity,
    supportingEvidence: Object.freeze([...input.supportingEvidence]),
    contradictoryEvidence: Object.freeze([...input.contradictoryEvidence]),
    invalidatingConditions: Object.freeze([...input.invalidatingConditions]),
    knowledgeLayer: 'structured_observation',
    modelRoute: input.modelRoute ?? null,
    evaluatedAt: input.evaluatedAt,
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
  });
}

export function inferDirectionFromSurprise(event: MacroEventArtifact): ImpactDirectionHypothesis {
  if (!event.surprise?.calculable) return 'UNKNOWN';
  if (event.surprise.surpriseMinorUnits !== null) {
    if (event.surprise.surpriseMinorUnits > 0n) {
      if (event.domain === 'inflation_release' || event.domain === 'employment_release') {
        return event.domain === 'inflation_release' ? 'BEARISH' : 'BULLISH';
      }
      return 'BULLISH';
    }
    if (event.surprise.surpriseMinorUnits < 0n) {
      if (event.domain === 'inflation_release') return 'BULLISH';
      return 'BEARISH';
    }
    return 'NEUTRAL';
  }
  return 'UNKNOWN';
}
