import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { HeliosSpecialistRole, ModelProvider, PrivacyClass, ResearchMeshFailure } from './types.ts';

export type ModelRouteDecision = {
  readonly provider: ModelProvider;
  readonly modelId: string;
  readonly version: string;
  readonly promptTemplateId: string;
  readonly promptTemplateVersion: string;
  readonly privacyClass: PrivacyClass;
  readonly refusedPrivateToGrok: false;
};

const ROLE_DEFAULTS: Record<
  HeliosSpecialistRole,
  { readonly provider: ModelProvider; readonly modelId: string; readonly version: string; readonly template: string }
> = {
  OPPORTUNITY_RESEARCH: { provider: 'GROK', modelId: 'grok-research-v1', version: '1.0.0', template: 'helios/opportunity-research' },
  MACRO_FX: { provider: 'GROK', modelId: 'grok-macro-v1', version: '1.0.0', template: 'helios/macro-fx' },
  STAT_ARB_RELATIVE_VALUE: { provider: 'LOCAL_DETERMINISTIC', modelId: 'quant-spread-v1', version: '1.0.0', template: 'helios/stat-arb' },
  VOLATILITY: { provider: 'LOCAL_DETERMINISTIC', modelId: 'quant-vol-v1', version: '1.0.0', template: 'helios/volatility' },
  MICROSTRUCTURE: { provider: 'LOCAL_DETERMINISTIC', modelId: 'quant-micro-v1', version: '1.0.0', template: 'helios/microstructure' },
  EXECUTION_RESEARCH: { provider: 'S3M', modelId: 's3m-execution-v1', version: '1.0.0', template: 'helios/execution-research' },
  EVIDENCE_VERIFIER: { provider: 'LOCAL_DETERMINISTIC', modelId: 'evidence-verifier-v1', version: '1.0.0', template: 'helios/evidence-verifier' },
  ADVERSARIAL_CRITIC: { provider: 'S3M', modelId: 's3m-critic-v1', version: '1.0.0', template: 'helios/adversarial-critic' },
  META_ALLOCATOR: { provider: 'LOCAL_DETERMINISTIC', modelId: 'meta-allocator-v1', version: '1.0.0', template: 'helios/meta-allocator' },
};

export function routeSpecialistModel(input: {
  readonly role: HeliosSpecialistRole;
  readonly privacyClass: PrivacyClass;
}): Result<ModelRouteDecision, ResearchMeshFailure> {
  const defaults = ROLE_DEFAULTS[input.role];
  let provider = defaults.provider;

  if (input.privacyClass === 'CUSTOMER_PRIVATE') {
    if (provider === 'GROK') {
      provider = 'S3M';
    }
  }

  if (input.privacyClass === 'CUSTOMER_PRIVATE' && provider === 'GROK') {
    return err({
      code: 'PRIVATE_CONTEXT_ROUTING_REFUSED',
      message: 'private customer context cannot be routed to Grok',
    });
  }

  return ok(
    Object.freeze({
      provider,
      modelId: provider === 'S3M' && defaults.provider === 'GROK' ? 's3m-private-research-v1' : defaults.modelId,
      version: defaults.version,
      promptTemplateId: defaults.template,
      promptTemplateVersion: '1.0.0',
      privacyClass: input.privacyClass,
      refusedPrivateToGrok: false as const,
    }),
  );
}

export function sameModelAndEvidence(
  left: { readonly modelProvider: ModelProvider; readonly modelId: string; readonly sharedEvidenceIds: readonly string[] },
  right: { readonly modelProvider: ModelProvider; readonly modelId: string; readonly sharedEvidenceIds: readonly string[] },
): boolean {
  if (left.modelProvider !== right.modelProvider || left.modelId !== right.modelId) {
    return false;
  }
  const shared = left.sharedEvidenceIds.filter((id) => right.sharedEvidenceIds.includes(id));
  return shared.length > 0;
}
