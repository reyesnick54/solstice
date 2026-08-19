/**
 * Realized compute / AI usage mapping.
 *
 * Inference tokens keep token_inference / TOKEN semantics.
 * Training prefers verified GPU resource-time.
 * Tokens never convert into GPU-seconds in this layer.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import { TOKEN_INFERENCE_QUALIFIER } from '../../../../units/constitution.ts';
import {
  computeRefusal,
  type ComputeRefusal,
  type ComputeSourceObservation,
  type ComputeTokenBreakdown,
} from './types.ts';

export function resolveInferenceTokens(
  observation: ComputeSourceObservation,
): Result<ComputeTokenBreakdown, ComputeRefusal> {
  if (observation.workloadClass !== 'AI_INFERENCE') {
    return err(
      computeRefusal('TRAINING_INFERENCE_TOKEN_SEMANTIC', 'inference token semantics require workloadClass AI_INFERENCE'),
    );
  }
  if (observation.factType !== 'AI_INFERENCE_USAGE') {
    return err(computeRefusal('TRAINING_INFERENCE_TOKEN_SEMANTIC', 'inference tokens cannot silently become training usage'));
  }
  const breakdown = observation.tokenBreakdown;
  if (!breakdown) {
    return err(computeRefusal('TOKEN_COMPONENT_NOT_INFERENCE', 'AI_INFERENCE_USAGE requires an explicit token component'));
  }
  if (breakdown.component !== 'TOTAL_PROCESSED_TOKENS' && breakdown.component !== 'INPUT_TOKENS' && breakdown.component !== 'OUTPUT_TOKENS') {
    return err(computeRefusal('TOKEN_COMPONENT_NOT_INFERENCE', 'token component is not an inference-processed counter'));
  }
  if (!breakdown.mapsToTokenInference) {
    return err(
      computeRefusal(
        'TOKEN_COMPONENT_NOT_INFERENCE',
        'token component does not satisfy INFERENCE_PROCESSED_TOKENS qualification',
      ),
    );
  }
  const source = exactQuantity({
    mantissa: BigInt(observation.numericValue),
    scale: 0,
    numerator: 1n,
    denominator: 1n,
    unitId: 'token_inference',
  });
  if (!source.ok) {
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', source.error.detail));
  }
  const receipt = convertExact({
    source: source.value,
    targetUnitId: 'TOKEN',
    context: {
      semanticQualifier: TOKEN_INFERENCE_QUALIFIER,
      factType: 'AI_INFERENCE_USAGE',
      productiveCategory: 'AI_COMPUTE',
    },
  });
  if (!receipt.ok) {
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }
  return ok(
    Object.freeze({
      ...breakdown,
      mapsToTokenInference: true,
    }),
  );
}

export function refuseTokenGpuConversion(observation: ComputeSourceObservation): Result<never, ComputeRefusal> {
  return err(
    computeRefusal(
      'TOKEN_GPU_CONVERSION_FORBIDDEN',
      `token count ${observation.numericValue} cannot become GPU-seconds; tokens and GPU-time are different dimensions`,
    ),
  );
}

export function refuseTrainingInferenceTokens(observation: ComputeSourceObservation): Result<never, ComputeRefusal> {
  return err(
    computeRefusal(
      'TRAINING_INFERENCE_TOKEN_SEMANTIC',
      `AI_TRAINING_USAGE cannot reuse inference token semantics from ${observation.unit}`,
    ),
  );
}

export function inferenceTokensRemainTokens(): 'token_inference' {
  return 'token_inference';
}
