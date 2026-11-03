/**
 * Historical/legal provenance for assimilated upstream references.
 * This manifest is metadata only — it must not function as a runtime pin or updater target.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NativeAssimilationProvenanceEntry = {
  readonly upstreamId: string;
  readonly repository: string;
  readonly historicalReferenceSha: string;
  readonly license: string;
  readonly assimilationMode: 'native_reimplementation' | 'design_reference_only';
  readonly nativeOwnerSummary: string;
  readonly runtimePin: false;
};

export type NativeAssimilationProvenanceManifest = {
  readonly schema: 'sunrey.helios.native-assimilation-provenance.v1';
  readonly purpose: 'historical_and_legal_attribution_only';
  readonly runtimePin: false;
  readonly recordedAt: string;
  readonly gitSha: string;
  readonly upstream: readonly NativeAssimilationProvenanceEntry[];
  readonly noticesPath: 'docs/helios/native-assimilation/THIRD_PARTY_NOTICES.md';
};

const FALLBACK_UPSTREAM: readonly NativeAssimilationProvenanceEntry[] = Object.freeze([
  {
    upstreamId: 'bytex',
    repository: 'https://github.com/BYTEX-TRADE/bytex',
    historicalReferenceSha: '67b3e103043476a0490bb7afa146ec9ac339b116',
    license: 'Apache-2.0',
    assimilationMode: 'native_reimplementation',
    nativeOwnerSummary: 'packages/platform/src/helios/execution-twin, execution-routing, strategy-lab',
    runtimePin: false,
  },
  {
    upstreamId: 'openchart',
    repository: 'https://github.com/longsurf-ai/openchart',
    historicalReferenceSha: '8109466bfb5d44c32e0e03e9337eaca48b837ab4',
    license: 'MIT',
    assimilationMode: 'native_reimplementation',
    nativeOwnerSummary: 'packages/platform/src/helios/feature-fabric, research-monitor',
    runtimePin: false,
  },
  {
    upstreamId: 'tradingagents',
    repository: 'https://github.com/TauricResearch/TradingAgents',
    historicalReferenceSha: 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
    license: 'Apache-2.0',
    assimilationMode: 'native_reimplementation',
    nativeOwnerSummary: 'packages/agentic-capital-mesh, packages/platform/src/helios/open-source*',
    runtimePin: false,
  },
  {
    upstreamId: 'seris',
    repository: 'https://github.com/aowang-ai/seris',
    historicalReferenceSha: 'f73dbbb0cd7e3b52601abf905bb871cdb9098550',
    license: 'Apache-2.0',
    assimilationMode: 'native_reimplementation',
    nativeOwnerSummary: 'packages/strategy-lab, os13 strategy sandbox, packages/sunrey-agent',
    runtimePin: false,
  },
  {
    upstreamId: 'polymarket-prediction-bot',
    repository: 'https://github.com/semrincaballero/Polymarket-Prediction-Bot',
    historicalReferenceSha: '1f7c9761ddd26863242e3ed4f83c230ee38aebeb',
    license: 'MIT',
    assimilationMode: 'native_reimplementation',
    nativeOwnerSummary: 'packages/platform/src/helios/open-source/os14-prediction-market',
    runtimePin: false,
  },
]);

export function buildNativeAssimilationProvenanceManifest(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly recordedAt: string;
}): NativeAssimilationProvenanceManifest {
  const lockPath = join(input.root, 'docs/helios/open-source/upstream-lock.json');
  let upstream = FALLBACK_UPSTREAM;

  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
        upstream?: Array<{
          id: string;
          repository: string;
          upstreamSha: string;
          license: string;
        }>;
      };
      if (Array.isArray(lock.upstream) && lock.upstream.length > 0) {
        upstream = Object.freeze(
          lock.upstream.map((row) =>
            Object.freeze({
              upstreamId: row.id,
              repository: row.repository,
              historicalReferenceSha: row.upstreamSha,
              license: row.license,
              assimilationMode: 'native_reimplementation' as const,
              nativeOwnerSummary: 'see docs/helios/native-assimilation/NATIVE_CAPABILITY_PARITY_MATRIX.md',
              runtimePin: false as const,
            }),
          ),
        );
      }
    } catch {
      /* keep fallback */
    }
  }

  return Object.freeze({
    schema: 'sunrey.helios.native-assimilation-provenance.v1',
    purpose: 'historical_and_legal_attribution_only',
    runtimePin: false,
    recordedAt: input.recordedAt,
    gitSha: input.gitSha,
    upstream,
    noticesPath: 'docs/helios/native-assimilation/THIRD_PARTY_NOTICES.md',
  });
}
