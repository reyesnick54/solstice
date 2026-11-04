/**
 * Point-in-time earnings surprise fabric (simulation / research plane).
 */

import { buildEarningsSurpriseTensor } from './tensor.ts';
import { buildEarningsSurpriseVector } from './vector.ts';
import type { BuildSurpriseTensorInput, EarningsSurpriseTensor, EarningsSurpriseVector } from './types.ts';

export type CompileEarningsSurpriseResult = {
  readonly tensor: EarningsSurpriseTensor;
  readonly vector: EarningsSurpriseVector;
  readonly grantsExecutionAuthority: false;
};

export function compileEarningsSurprisePlane(input: BuildSurpriseTensorInput & { readonly vectorId: string }): CompileEarningsSurpriseResult {
  const tensor = buildEarningsSurpriseTensor(input);
  const vector = buildEarningsSurpriseVector({ vectorId: input.vectorId, tensor });
  return Object.freeze({
    tensor,
    vector,
    grantsExecutionAuthority: false as const,
  });
}

export function createEarningsSurpriseFabric(): {
  readonly compile: typeof compileEarningsSurprisePlane;
} {
  return Object.freeze({
    compile: compileEarningsSurprisePlane,
  });
}
