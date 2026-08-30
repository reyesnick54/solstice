/**
 * Normalized participation and dual-token weight computation.
 */

import {
  dualBonusTerm,
  PARTICIPATION_SCALE,
  ratioScaled,
  sqrtTransformScaled,
  weightedParticipation,
} from './fixed-point.ts';
import { coefficientsForCategory } from './policy.ts';
import type {
  AccessAllocationCategory,
  DualParticipationPolicy,
  EligibleSupplySnapshot,
  NormalizedParticipation,
  ParticipationTransformPolicy,
  TokenParticipationSnapshot,
} from './types.ts';
import type { SubjectRef } from '../ids.ts';

function applyTransform(
  participationScaled: bigint,
  transform: ParticipationTransformPolicy,
): bigint {
  let value = sqrtTransformScaled(participationScaled);
  if (transform.maximumEffectiveParticipation !== null && value > transform.maximumEffectiveParticipation) {
    value = transform.maximumEffectiveParticipation;
  }
  return value;
}

export function normalizeParticipation(
  snapshot: TokenParticipationSnapshot,
  supply: EligibleSupplySnapshot,
): { readonly sunReyParticipationScaled: bigint; readonly moonReyParticipationScaled: bigint } {
  return Object.freeze({
    sunReyParticipationScaled: ratioScaled(snapshot.eligibleSunReyTwab, supply.sunReyEligibleBase),
    moonReyParticipationScaled: ratioScaled(snapshot.eligibleMoonReyTwab, supply.moonReyEligibleBase),
  });
}

export function computeNormalizedWeight(
  subjectRef: SubjectRef,
  epochId: string,
  category: AccessAllocationCategory,
  snapshot: TokenParticipationSnapshot,
  supply: EligibleSupplySnapshot,
  transform: ParticipationTransformPolicy,
  dualPolicy: DualParticipationPolicy,
  commitmentMultiplierScaled: bigint = PARTICIPATION_SCALE,
): NormalizedParticipation {
  const normalized = normalizeParticipation(snapshot, supply);
  const gSunRey = applyTransform(normalized.sunReyParticipationScaled, transform);
  const gMoonRey = applyTransform(normalized.moonReyParticipationScaled, transform);
  const dualBonus = dualBonusTerm(gSunRey, gMoonRey);
  const coeffs = coefficientsForCategory(dualPolicy, category);
  let weight = weightedParticipation(
    coeffs.alphaBps,
    gSunRey,
    coeffs.betaBps,
    gMoonRey,
    coeffs.gammaBps,
    dualBonus,
  );
  const cappedMultiplier =
    commitmentMultiplierScaled > PARTICIPATION_SCALE * 2n
      ? PARTICIPATION_SCALE * 2n
      : commitmentMultiplierScaled;
  weight = (weight * cappedMultiplier) / PARTICIPATION_SCALE;

  return Object.freeze({
    subjectRef,
    epochId,
    category,
    sunReyParticipationScaled: normalized.sunReyParticipationScaled,
    moonReyParticipationScaled: normalized.moonReyParticipationScaled,
    gSunReyScaled: gSunRey,
    gMoonReyScaled: gMoonRey,
    dualBonusScaled: dualBonus,
    weightScaled: weight,
  });
}
