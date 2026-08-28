import { asModelId, asModelVersion } from '../../model-registry/src/ids.ts';
import {
  CANONICAL_GROK_MODEL_ID,
  CANONICAL_GROK_MODEL_VERSION,
  CANONICAL_LOCAL_TEST_MODEL_ID,
  CANONICAL_LOCAL_TEST_MODEL_VERSION,
  CANONICAL_S3M_MODEL_ID,
  CANONICAL_S3M_MODEL_VERSION,
} from './registry.ts';
import { InferenceModelCatalog, type InferenceModelRecord } from './catalog.ts';
import { AI_APPROVED_PURPOSES, type AiApprovedPurpose } from './taxonomy.ts';

export const CANONICAL_HTTPS_GENERIC_MODEL_ID = asModelId('mdl_sunrey_https_generic');
export const CANONICAL_HTTPS_GENERIC_MODEL_VERSION = asModelVersion('https-generic-v1');
export const RESERVED_OPENAI_MODEL_ID = asModelId('mdl_sunrey_openai_reserved');
export const RESERVED_ANTHROPIC_MODEL_ID = asModelId('mdl_sunrey_anthropic_reserved');
export const RESERVED_MISTRAL_MODEL_ID = asModelId('mdl_sunrey_mistral_reserved');

const ALL_PURPOSES: readonly AiApprovedPurpose[] = AI_APPROVED_PURPOSES;
const PUBLIC_PURPOSES: readonly AiApprovedPurpose[] = Object.freeze([
  'SIMPLE_CLASSIFICATION',
  'USER_SUPPORT',
  'GENERAL_ASSISTANT',
  'MARKET_OPPORTUNITY_RESEARCH',
]);

export function seedInferenceModelCatalog(catalog: InferenceModelCatalog): readonly InferenceModelRecord[] {
  const records: InferenceModelRecord[] = [
    {
      modelId: CANONICAL_LOCAL_TEST_MODEL_ID,
      provider: 'LOCAL_TEST',
      providerModel: 'local-test',
      version: CANONICAL_LOCAL_TEST_MODEL_VERSION,
      capabilities: Object.freeze(['language', 'tools', 'structured', 'streaming']),
      contextWindow: 8_192,
      supportsStreaming: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      approvedPurposes: ALL_PURPOSES,
      environment: 'SIMULATION',
      status: 'TEST',
      cost: Object.freeze({ inputMicrosPer1kTokens: 0, outputMicrosPer1kTokens: 0, currency: 'USD' }),
      latencyClass: 'LOW',
      dataHandling: Object.freeze(['PUBLIC', 'INTERNAL', 'PERSONAL', 'FINANCIAL_SENSITIVE']),
      jurisdictionRestrictions: Object.freeze([]),
      liveApproved: false,
    },
    {
      modelId: CANONICAL_S3M_MODEL_ID,
      provider: 'S3M',
      providerModel: 's3m-primary',
      version: CANONICAL_S3M_MODEL_VERSION,
      capabilities: Object.freeze(['language', 'tools', 'structured', 'streaming']),
      contextWindow: 32_768,
      supportsStreaming: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      approvedPurposes: ALL_PURPOSES,
      environment: 'SANDBOX',
      status: 'APPROVED_SANDBOX',
      cost: Object.freeze({ inputMicrosPer1kTokens: 40, outputMicrosPer1kTokens: 80, currency: 'USD' }),
      latencyClass: 'STANDARD',
      dataHandling: Object.freeze(['PUBLIC', 'INTERNAL', 'PERSONAL', 'FINANCIAL_SENSITIVE']),
      jurisdictionRestrictions: Object.freeze([]),
      liveApproved: false,
    },
    {
      modelId: CANONICAL_HTTPS_GENERIC_MODEL_ID,
      provider: 'HTTPS_GENERIC',
      providerModel: 'generic-sandbox',
      version: CANONICAL_HTTPS_GENERIC_MODEL_VERSION,
      capabilities: Object.freeze(['language', 'structured']),
      contextWindow: 4_096,
      supportsStreaming: true,
      supportsTools: false,
      supportsStructuredOutput: true,
      approvedPurposes: PUBLIC_PURPOSES,
      environment: 'SANDBOX',
      status: 'APPROVED_SANDBOX',
      cost: Object.freeze({ inputMicrosPer1kTokens: 10, outputMicrosPer1kTokens: 20, currency: 'USD' }),
      latencyClass: 'LOW',
      dataHandling: Object.freeze(['PUBLIC']),
      jurisdictionRestrictions: Object.freeze([]),
      liveApproved: false,
    },
    {
      modelId: CANONICAL_GROK_MODEL_ID,
      provider: 'XAI_GROK',
      providerModel: 'grok-4.6',
      version: CANONICAL_GROK_MODEL_VERSION,
      capabilities: Object.freeze(['language', 'structured', 'streaming']),
      contextWindow: 500_000,
      supportsStreaming: true,
      supportsTools: false,
      supportsStructuredOutput: true,
      approvedPurposes: PUBLIC_PURPOSES,
      environment: 'SANDBOX',
      status: 'APPROVED_SANDBOX',
      cost: Object.freeze({ inputMicrosPer1kTokens: 2_000, outputMicrosPer1kTokens: 6_000, currency: 'USD' }),
      latencyClass: 'STANDARD',
      dataHandling: Object.freeze(['PUBLIC']),
      jurisdictionRestrictions: Object.freeze([]),
      liveApproved: false,
    },
    disabledVendor(RESERVED_OPENAI_MODEL_ID, 'openai-reserved'),
    disabledVendor(RESERVED_ANTHROPIC_MODEL_ID, 'anthropic-reserved'),
    disabledVendor(RESERVED_MISTRAL_MODEL_ID, 'mistral-reserved'),
  ];
  for (const record of records) {
    const registered = catalog.register(record);
    if (!registered.ok) {
      throw new Error(registered.error.detail);
    }
  }
  return catalog.list();
}

function disabledVendor(modelId: ReturnType<typeof asModelId>, providerModel: string): InferenceModelRecord {
  return {
    modelId,
    provider: 'HTTPS_GENERIC',
    providerModel,
    version: asModelVersion('reserved-v0'),
    capabilities: Object.freeze([]),
    contextWindow: 0,
    supportsStreaming: false,
    supportsTools: false,
    supportsStructuredOutput: false,
    approvedPurposes: Object.freeze([]),
    environment: 'SIMULATION',
    status: 'DISABLED',
    cost: Object.freeze({ inputMicrosPer1kTokens: 0, outputMicrosPer1kTokens: 0, currency: 'USD' }),
    latencyClass: 'STANDARD',
    dataHandling: Object.freeze(['PUBLIC']),
    jurisdictionRestrictions: Object.freeze([]),
    liveApproved: false,
  };
}
