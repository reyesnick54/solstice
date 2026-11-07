/**
 * ALT08 — AlternativeDataSkeptic gate (platform mirror of mesh skeptic checks).
 */

import { SKEPTIC_ALT_ATTACK_VECTORS, type AlternativeDataSkepticAttackVector } from './taxonomy.ts';
import type { SkepticFinding } from './types.ts';

export type SkepticCheckInput = {
  readonly vector: AlternativeDataSkepticAttackVector;
  readonly detail: string;
  readonly passed: boolean;
};

export function runAlternativeDataSkepticChecks(
  inputs: readonly SkepticCheckInput[],
): readonly SkepticFinding[] {
  const byVector = new Map<AlternativeDataSkepticAttackVector, SkepticCheckInput>();
  for (const row of inputs) {
    byVector.set(row.vector, row);
  }
  return Object.freeze(
    SKEPTIC_ALT_ATTACK_VECTORS.map((vector) => {
      const hit = byVector.get(vector);
      if (!hit) {
        return Object.freeze({
          vector,
          passed: false,
          detail: `missing skeptic check for ${vector}`,
        });
      }
      return Object.freeze({
        vector,
        passed: hit.passed,
        detail: hit.detail,
      });
    }),
  );
}

export function skepticGateBlocksAafCertification(findings: readonly SkepticFinding[]): boolean {
  return findings.some((row) => !row.passed);
}
