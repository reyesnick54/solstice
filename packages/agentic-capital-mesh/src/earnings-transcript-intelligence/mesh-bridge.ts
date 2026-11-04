import type {
  EarningsTranscriptIntelligencePort,
  EarningsTranscriptMeshAnalyzeInput,
  EarningsTranscriptMeshAnalyzeResult,
} from './types.ts';

export type EarningsTranscriptMeshBridge = {
  readonly analyze: (input: EarningsTranscriptMeshAnalyzeInput) => EarningsTranscriptMeshAnalyzeResult;
};

export function createEarningsTranscriptMeshBridge(input: {
  readonly port: EarningsTranscriptIntelligencePort;
}): EarningsTranscriptMeshBridge {
  return Object.freeze({
    analyze: (request) => input.port.analyzeForMesh(request),
  });
}
