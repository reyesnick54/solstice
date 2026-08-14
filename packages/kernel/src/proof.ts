import type { UtcInstant } from '@solstice/domain';
import type { ActionIntent } from './action-intent.ts';
import type { Posture } from './posture.ts';

export const PROOF_KINDS = [
  'IDENTITY',
  'POLICY',
  'PURPOSE',
  'SANCTIONS',
  'AML',
  'EXECUTION_AUTHORITY',
] as const;

export type ProofKind = (typeof PROOF_KINDS)[number];

export type Proof = {
  readonly kind: ProofKind;
  readonly posture: Posture;
  readonly reasons: readonly string[];
  readonly evaluatedAt: UtcInstant;
  readonly details?: Readonly<Record<string, unknown>>;
};

export function freezeProof(proof: Proof): Proof {
  return Object.freeze({
    kind: proof.kind,
    posture: proof.posture,
    reasons: Object.freeze(proof.reasons.slice()),
    evaluatedAt: proof.evaluatedAt,
    ...(proof.details === undefined ? {} : { details: Object.freeze({ ...proof.details }) }),
  });
}

export type ProofEvaluator = (intent: ActionIntent) => Proof;
