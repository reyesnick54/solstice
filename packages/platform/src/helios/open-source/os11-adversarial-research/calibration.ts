import type { BearCase, BullCase, ResearchDisagreementMetric, RiskCase } from './types.ts';
import type { DebateInformationValueHint } from './taxonomy.ts';

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 10_000) return 10_000;
  return Math.round(value);
}

function confidenceSpreadBps(bull: BullCase, bear: BearCase, risk: RiskCase): number {
  const all = [...bull.claims, ...bear.claims, ...risk.claims].map((row) => row.confidenceBps);
  if (all.length === 0) return 0;
  return Math.max(...all) - Math.min(...all);
}

function sharedEvidenceAgreementBps(bull: BullCase, bear: BearCase): number {
  const bullSet = new Set(bull.supportingEvidenceIds);
  const bearSet = new Set(bear.supportingEvidenceIds);
  if (bullSet.size === 0 && bearSet.size === 0) return 0;
  let shared = 0;
  for (const id of bullSet) {
    if (bearSet.has(id)) shared += 1;
  }
  const denom = Math.max(bullSet.size, bearSet.size, 1);
  return clampScore((shared / denom) * 10_000);
}

/**
 * Deterministic disagreement calibration (no LLM). Feeds H20 value-of-information hints.
 */
export function computeResearchDisagreementMetric(input: {
  readonly bullCase: BullCase;
  readonly bearCase: BearCase;
  readonly riskCase: RiskCase;
}): ResearchDisagreementMetric {
  const spread = confidenceSpreadBps(input.bullCase, input.bearCase, input.riskCase);
  const sharedAgreement = sharedEvidenceAgreementBps(input.bullCase, input.bearCase);
  const opposingPairs = Math.min(input.bullCase.claims.length, input.bearCase.claims.length);
  const riskFactorWeight = input.riskCase.dominantRiskFactors.length * 800;
  const unsupportedBull = input.bullCase.claims.filter((row) => row.evidenceIds.length === 0).length;
  const disagreementScore = clampScore(spread + opposingPairs * 1200 + riskFactorWeight - unsupportedBull * 400);

  const materialDisagreement = disagreementScore >= 4500 || opposingPairs >= 1;
  const lowValueDisagreement =
    materialDisagreement && sharedAgreement >= 7500 && spread < 2000 && input.riskCase.dominantRiskFactors.length <= 1;

  let informationValueHint: DebateInformationValueHint = 'NONE';
  if (materialDisagreement && !lowValueDisagreement) {
    informationValueHint = disagreementScore >= 7000 ? 'HIGH' : 'MEDIUM';
  } else if (lowValueDisagreement) {
    informationValueHint = 'LOW';
  }

  const notes: string[] = [
    `confidenceSpreadBps=${spread}`,
    `sharedEvidenceAgreementBps=${sharedAgreement}`,
    `opposingClaimPairs=${opposingPairs}`,
  ];
  if (lowValueDisagreement) {
    notes.push('low-value disagreement: additional model rounds unlikely to change material uncertainty');
  }

  return Object.freeze({
    disagreementScore,
    confidenceSpreadBps: spread,
    opposingClaimPairs: opposingPairs,
    sharedEvidenceAgreementBps: sharedAgreement,
    materialDisagreement,
    lowValueDisagreement,
    informationValueHint,
    calibrationNotes: Object.freeze(notes),
  });
}
