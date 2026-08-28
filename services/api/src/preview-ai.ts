import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { ModelRegistry } from '../../../packages/model-registry/src/registry.ts';
import {
  AiModelGateway,
  NodeHttpsInferenceTransport,
  XaiGrokAiProvider,
  createDefaultAiRuntimePolicy,
  researchPublicMarketOpportunities,
  seedCanonicalAiModels,
  type MarketOpportunityResearchResult,
} from '../../../packages/ai-runtime/src/index.ts';
import { CloudRunSecretProvider } from '../../../packages/security/src/secrets.ts';
import type { SimulationRuntime } from '../../accounts/src/runtime.ts';

export const PREVIEW_MARKET_RESEARCH_TTL_SECONDS = 1_800;
const DEFAULT_UNIVERSE = Object.freeze(['SPY', 'QQQ']);

export function createPreviewAiGateway(runtime: SimulationRuntime): AiModelGateway | null {
  if (process.env.SUNREY_EXTERNAL_AI_PREVIEW_ENABLED !== 'true') {
    return null;
  }
  const operator = runtime.identity.service.resolveActorContext('operator_1');
  if (!operator.ok) {
    return null;
  }
  const registry = new ModelRegistry();
  const seeded = seedCanonicalAiModels(registry, operator.value, asUtcInstant(runtime.clock.now()));
  if (!seeded.ok) {
    return null;
  }
  const secrets = new CloudRunSecretProvider();
  const configEnv = process.env;
  const provider = new XaiGrokAiProvider({
    clock: runtime.clock,
    config: { env: configEnv, credentialRef: configEnv.XAI_CREDENTIAL_REF ?? 'secret://cloud-run/xai-api-key' },
    secrets,
    transport: new NodeHttpsInferenceTransport({ enabled: true, secrets }),
  });
  return new AiModelGateway({
    clock: runtime.clock,
    governanceRegistry: registry,
    policy: createDefaultAiRuntimePolicy('S3M_PRIMARY'),
    providers: { XAI_GROK: provider },
    secrets,
  });
}

export class PreviewMarketResearchCache {
  private entry: {
    readonly research: MarketOpportunityResearchResult;
    readonly generatedAt: string;
    readonly provider: string;
    readonly model: string;
    readonly expiresAt: string;
  } | null = null;
  private lastFailure: string | null = null;

  constructor(
    private readonly gateway: AiModelGateway | null,
    private readonly now: () => string,
    private readonly ttlSeconds = PREVIEW_MARKET_RESEARCH_TTL_SECONDS,
  ) {}

  get(): MarketOpportunityResearchResult | null {
    if (!this.gateway) return null;
    const current = Date.parse(this.now());
    if (this.entry && Date.parse(this.entry.expiresAt) > current) {
      return this.entry.research;
    }
    const generatedAt = this.now();
    const result = researchPublicMarketOpportunities(this.gateway, {
      requestId: `preview-market-research-${current}`,
      correlationId: `preview-market-research-${current}`,
      userApprovedExternal: true,
      marketUniverse: configuredUniverse(),
      publicContext: Object.freeze({
        currentTimestamp: generatedAt,
        approvedResearchStrategies: Object.freeze(['PUBLIC_MARKET_OPPORTUNITY_RESEARCH']),
        publicMarketCategories: Object.freeze(['PUBLIC_EQUITIES', 'PUBLIC_DIGITAL_ASSETS']),
        researchConstraints: Object.freeze([
          'bounded universe only',
          'public evidence only',
          'no customer personalization',
          'insufficient evidence must be reported',
        ]),
        universeSource: process.env.SUNREY_MARKET_RESEARCH_UNIVERSE ? 'environment' : 'simulation-default',
      }),
    });
    if (!result.ok) {
      this.lastFailure = result.error.code;
      return null;
    }
    const expiresAt = new Date(current + this.ttlSeconds * 1_000).toISOString();
    this.entry = Object.freeze({
      research: result.value.research,
      generatedAt,
      provider: result.value.gateway.providerKind,
      model: result.value.gateway.modelRef.modelId,
      expiresAt,
    });
    this.lastFailure = null;
    return this.entry.research;
  }

  diagnostics(): Readonly<Record<string, unknown>> {
    const fresh = this.entry !== null && Date.parse(this.entry.expiresAt) > Date.parse(this.now());
    return Object.freeze({
      externalAiPreviewEnabled: this.gateway !== null,
      grokConfigured: this.gateway?.runtime.health().XAI_GROK.healthy ?? false,
      grokCredentialResolvable: this.gateway?.runtime.health().XAI_GROK.healthy ?? false,
      grokResearchAvailable: fresh,
      marketResearchCacheStatus: this.entry ? (fresh ? 'FRESH' : 'STALE') : 'EMPTY',
      lastResearchAt: this.entry?.generatedAt ?? null,
      lastFailure: this.lastFailure,
      expiresAt: this.entry?.expiresAt ?? null,
    });
  }
}

function configuredUniverse(): readonly string[] {
  const configured = process.env.SUNREY_MARKET_RESEARCH_UNIVERSE
    ?.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Object.freeze(configured && configured.length > 0 ? configured : [...DEFAULT_UNIVERSE]);
}
