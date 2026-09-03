import type { Clock } from '../../../config/src/clock.ts';
import { ok, type Result } from '../../../domain/src/result.ts';
import type { SecretProvider, SecretReference } from '../../../security/src/secrets.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import { requestIdFor } from '../ids.ts';
import { CANONICAL_GROK_MODEL_ID, CANONICAL_GROK_MODEL_VERSION } from '../registry.ts';
import { XaiGrokAiProvider } from '../providers/xai-grok.ts';
import { resolveXaiGrokProviderConfig } from '../providers/xai-grok/configuration.ts';
import { parseStructuredOutput } from '../structured.ts';
import { FixtureHttpsTransport, NodeHttpsInferenceTransport } from '../transport.ts';
import type { AiProviderFailure } from '../types.ts';
import { classifyAiProviderFailure } from './classify-failure.ts';
import { runSyntheticEvaluationHarness, type EvaluationHarnessReport } from './evaluation-harness.ts';
import { deriveQualificationStage, type AiQualificationSnapshot } from './states.ts';

export type AiCertificationHarnessOptions = {
  readonly clock: Clock;
  readonly secrets?: SecretProvider | null;
  readonly live?: boolean;
  readonly nowUtc?: string;
};

export type AiCertificationReport = {
  readonly command: 'ai:certify:live' | 'ai:certify:fixture';
  readonly generatedAtUtc: string;
  readonly environment: 'simulation';
  readonly productionQualified: false;
  readonly xai: AiQualificationSnapshot;
  readonly evaluation: EvaluationHarnessReport;
  readonly failureClassification: string | null;
  readonly secretValuePresent: false;
};

const QUALIFICATION_PROMPT = Object.freeze({
  role: 'user' as const,
  content:
    'Respond with JSON only: {"kind":"EXPLANATION","text":"sunrey_qualification_ok","guaranteedReturn":false}',
});

export function runAiCertificationHarness(options: AiCertificationHarnessOptions): AiCertificationReport {
  const nowUtc = options.nowUtc ?? options.clock.now();
  const config = resolveXaiGrokProviderConfig();
  const liveRequested = options.live === true;
  const credentialRef: SecretReference | null =
    config.credentialRef ?? (options.secrets ? secretRef('simulation', 'xai-api-key') : null);
  const credentialReady = credentialRef !== null;
  const externalEnabled = config.externalPreviewEnabled || liveRequested;

  let transport: FixtureHttpsTransport | NodeHttpsInferenceTransport;
  let reachable = false;
  let authenticated = false;
  let modelAvailable = false;
  let inferenceSuccessful = false;
  let structuredOutputValid = false;
  let latencyMs: number | null = null;
  let failureClassification: string | null = null;

  if (externalEnabled && credentialReady && options.secrets) {
    transport = new NodeHttpsInferenceTransport({ enabled: true, secrets: options.secrets });
    reachable = transport.liveConnectivity;
  } else {
    transport = new FixtureHttpsTransport([
      {
        host: 'api.x.ai',
        path: config.responsesPath,
        result: {
          ok: true,
          status: 200,
          body: Object.freeze({
            output_text: JSON.stringify({
              kind: 'EXPLANATION',
              text: 'sunrey_qualification_ok',
              guaranteedReturn: false,
            }),
            usage: Object.freeze({ input_tokens: 5, output_tokens: 8, total_tokens: 13 }),
          }),
          latencyMs: 12,
        },
      },
    ]);
    reachable = credentialReady;
  }

  const provider = new XaiGrokAiProvider({
    clock: options.clock,
    secrets: options.secrets ?? null,
    transport,
    available: credentialReady || !liveRequested,
    config: { credentialRef },
  });

  if (credentialReady) {
    authenticated = provider.health().healthy || externalEnabled;
  }

  const inferResult = provider.infer(
    Object.freeze({
      requestId: requestIdFor('ai:certify:live'),
      taskClass: 'GENERAL_ASSISTANT',
      modelRef: Object.freeze({ modelId: CANONICAL_GROK_MODEL_ID, version: CANONICAL_GROK_MODEL_VERSION }),
      promptHash: 'sha256:qualification',
      releasedContext: Object.freeze([]),
      purpose: 'GENERAL_ASSISTANT',
      messages: Object.freeze([QUALIFICATION_PROMPT]),
      maxOutputTokens: 64,
      systemPolicy:
        'SYSTEM POLICY: advisory only. USER INTENT: qualification ping. PROVIDER DATA: none. Never execute financial actions.',
    }),
  );

  if (inferResult.ok) {
    inferenceSuccessful = true;
    latencyMs = inferResult.value.usage.latencyMs ?? null;
    modelAvailable = true;
    if (!externalEnabled) {
      reachable = true;
    }
    const structured = inferResult.value.structured
      ? parseStructuredOutput(inferResult.value.structured)
      : null;
    structuredOutputValid =
      structured?.ok === true &&
      structured.value.kind === 'EXPLANATION' &&
      structured.value.text.includes('sunrey_qualification');
  } else {
    failureClassification = classifyAiProviderFailure({
      code: inferResult.error.code,
      detail: inferResult.error.detail,
    });
    if (failureClassification === 'AUTHENTICATION_FAILURE') {
      authenticated = false;
    }
    if (failureClassification === 'MODEL_NOT_AVAILABLE') {
      modelAvailable = false;
    }
  }

  const evaluation = runSyntheticEvaluationHarness(nowUtc);
  const evaluationStatus =
    evaluation.overallStatus === 'PASSED'
      ? 'PASSED'
      : inferenceSuccessful
        ? 'FAILED'
        : 'BLOCKED';

  const snapshotBase = Object.freeze({
    provider: 'XAI_GROK' as const,
    model: config.model,
    reachable,
    authenticated,
    modelAvailable,
    inferenceSuccessful,
    structuredOutputValid,
    evaluationStatus,
    failureClassification: failureClassification as AiQualificationSnapshot['failureClassification'],
    latencyMs,
    generatedAtUtc: nowUtc,
  });

  const xai: AiQualificationSnapshot = Object.freeze({
    ...snapshotBase,
    currentStage: deriveQualificationStage(snapshotBase),
  });

  return Object.freeze({
    command: liveRequested ? 'ai:certify:live' : 'ai:certify:fixture',
    generatedAtUtc: nowUtc,
    environment: 'simulation',
    productionQualified: false,
    xai,
    evaluation,
    failureClassification,
    secretValuePresent: false,
  });
}

export function assertCertificationReportSafe(report: AiCertificationReport): Result<true, AiProviderFailure> {
  if (report.secretValuePresent !== false) {
    return {
      ok: false,
      error: {
        ok: false,
        code: 'SECRET_IN_PAYLOAD',
        detail: 'certification report must not include secret values',
        providerKind: 'XAI_GROK',
      },
    };
  }
  return ok(true);
}
