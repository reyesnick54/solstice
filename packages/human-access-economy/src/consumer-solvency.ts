/**
 * ACCESS-16 — Consumer-facing solvency posture projection.
 *
 * Exposes only Available / Limited / Temporarily unavailable.
 * Never exposes internal treasury or reserve balances.
 */

import {
  projectConsumerAvailability,
  type ConsumerAvailabilityPosture,
} from '../../access-economy/src/solvency/index.ts';

export type ConsumerSolvencyPosture = ConsumerAvailabilityPosture;

export function projectConsumerSolvencyPosture(input: {
  readonly poolSolvent: boolean;
  readonly allocatableUnits: bigint;
  readonly publishedUnits: bigint;
  readonly providerAvailable: boolean;
}): { readonly posture: ConsumerSolvencyPosture; readonly message: string } {
  const view = projectConsumerAvailability(input);
  return Object.freeze({
    posture: view.posture,
    message: view.message,
  });
}
