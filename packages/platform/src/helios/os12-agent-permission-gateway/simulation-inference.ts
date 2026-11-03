import type { ModelInferencePort } from './types.ts';

/** Fixture inference port for tests and simulation — no live provider connectivity. */
export function createSimulationModelInferencePort(
  outputText = 'simulation research summary',
): ModelInferencePort {
  return Object.freeze({
    infer(input) {
      const started = Date.now();
      const outputTokens = Math.max(1, Math.ceil(outputText.length / 4));
      return {
        ok: true,
        outputText: `${outputText} [${input.modelId}@${input.modelVersion}]`,
        latencyMs: Math.max(1, Date.now() - started),
        outputTokens,
      };
    },
  });
}
