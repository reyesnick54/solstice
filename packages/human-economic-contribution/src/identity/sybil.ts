import type { UtcInstant } from '../../../domain/src/time.ts';
import { commitIdentityDomain } from './commitments.ts';
import type { HumanEconomicIdentityId } from './ids.ts';
import { sybilSignalIdFor } from './ids.ts';
import type {
  SybilControlSignal,
  SybilEvaluationResult,
  SybilPolicyOutcome,
  SybilSignalKind,
} from './types.ts';

export type SybilEvaluationInput = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly evaluatedAt: UtcInstant;
  readonly uniquenessCommitment: string | null;
  readonly controllerRefs: readonly string[];
  readonly contributionFingerprints: readonly string[];
  readonly usageReceiptRefs: readonly string[];
  readonly externalIdentityCommitments: readonly string[];
  readonly credentialCommitments: readonly string[];
  readonly relatedActorIds: readonly HumanEconomicIdentityId[];
  readonly deviceAbuseSignals: readonly string[];
  readonly aiPatternSuggestions: readonly {
    readonly kind: SybilSignalKind;
    readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
    readonly evidenceCommitment: string;
    readonly relatedActorIds: readonly HumanEconomicIdentityId[];
  }[];
  readonly existingUniquenessOwners: ReadonlyMap<string, HumanEconomicIdentityId>;
  readonly existingExternalOwners: ReadonlyMap<string, HumanEconomicIdentityId>;
  readonly existingCredentialOwners: ReadonlyMap<string, HumanEconomicIdentityId>;
  readonly existingReceiptOwners: ReadonlyMap<string, HumanEconomicIdentityId>;
  readonly duplicateFingerprintOwners: ReadonlyMap<string, HumanEconomicIdentityId>;
};

function signal(
  humanActorId: HumanEconomicIdentityId,
  kind: SybilSignalKind,
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
  observedAt: UtcInstant,
  input: {
    readonly relatedActorIds?: readonly HumanEconomicIdentityId[];
    readonly relatedControllerRefs?: readonly string[];
    readonly evidenceCommitment: string;
    readonly aiSuggested?: boolean;
  },
): SybilControlSignal {
  return Object.freeze({
    signalId: sybilSignalIdFor(`${humanActorId}:${kind}:${observedAt}:${input.evidenceCommitment}`),
    humanActorId,
    kind,
    severity,
    relatedActorIds: Object.freeze(input.relatedActorIds ?? []),
    relatedControllerRefs: Object.freeze(input.relatedControllerRefs ?? []),
    evidenceCommitment: input.evidenceCommitment,
    aiSuggested: input.aiSuggested ?? false,
    autonomousBan: false,
    observedAt,
  });
}

function aggregateOutcome(signals: readonly SybilControlSignal[]): SybilPolicyOutcome {
  if (signals.some((item) => item.severity === 'HIGH' && !item.aiSuggested)) {
    return 'DENY_FUTURE_ACTION';
  }
  if (signals.length > 0) {
    return 'REQUIRE_REVIEW';
  }
  return 'ALLOW';
}

/**
 * Layered Sybil evaluation. AI may suggest suspicious patterns but never autonomously bans.
 */
export function evaluateSybilControls(input: SybilEvaluationInput): SybilEvaluationResult {
  const signals: SybilControlSignal[] = [];

  if (input.uniquenessCommitment) {
    const owner = input.existingUniquenessOwners.get(input.uniquenessCommitment);
    if (owner && owner !== input.humanActorId) {
      signals.push(
        signal(input.humanActorId, 'DUPLICATE_PROVIDER_UNIQUENESS', 'HIGH', input.evaluatedAt, {
          relatedActorIds: [owner],
          evidenceCommitment: input.uniquenessCommitment,
        }),
      );
    }
  }

  for (const externalCommitment of input.externalIdentityCommitments) {
    const owner = input.existingExternalOwners.get(externalCommitment);
    if (owner && owner !== input.humanActorId) {
      signals.push(
        signal(input.humanActorId, 'REUSED_EXTERNAL_IDENTITY', 'HIGH', input.evaluatedAt, {
          relatedActorIds: [owner],
          evidenceCommitment: externalCommitment,
        }),
      );
    }
  }

  for (const credentialCommitment of input.credentialCommitments) {
    const owner = input.existingCredentialOwners.get(credentialCommitment);
    if (owner && owner !== input.humanActorId) {
      signals.push(
        signal(input.humanActorId, 'REUSED_CREDENTIAL', 'HIGH', input.evaluatedAt, {
          relatedActorIds: [owner],
          evidenceCommitment: credentialCommitment,
        }),
      );
    }
  }

  for (const receiptRef of input.usageReceiptRefs) {
    const owner = input.existingReceiptOwners.get(receiptRef);
    if (owner && owner !== input.humanActorId) {
      signals.push(
        signal(input.humanActorId, 'REUSED_USAGE_RECEIPT', 'MEDIUM', input.evaluatedAt, {
          relatedActorIds: [owner],
          evidenceCommitment: receiptRef,
        }),
      );
    }
  }

  for (const fingerprint of input.contributionFingerprints) {
    const owner = input.duplicateFingerprintOwners.get(fingerprint);
    if (owner && owner !== input.humanActorId) {
      signals.push(
        signal(input.humanActorId, 'DUPLICATE_CONTRIBUTION_PATTERN', 'MEDIUM', input.evaluatedAt, {
          relatedActorIds: [owner],
          evidenceCommitment: fingerprint,
        }),
      );
    }
  }

  if (input.controllerRefs.length > 5) {
    signals.push(
      signal(input.humanActorId, 'MULTI_ACCOUNT_VELOCITY', 'MEDIUM', input.evaluatedAt, {
        relatedControllerRefs: input.controllerRefs,
        evidenceCommitment: commitIdentityDomain('sunrey.human-economic.sybil.velocity.v1', {
          controllerCount: input.controllerRefs.length,
        }),
      }),
    );
  }

  for (const abuse of input.deviceAbuseSignals) {
    signals.push(
      signal(input.humanActorId, 'DEVICE_ABUSE', 'MEDIUM', input.evaluatedAt, {
        evidenceCommitment: abuse,
      }),
    );
  }

  if (input.relatedActorIds.length > 0) {
    signals.push(
      signal(input.humanActorId, 'GRAPH_RELATIONSHIP', 'LOW', input.evaluatedAt, {
        relatedActorIds: input.relatedActorIds,
        evidenceCommitment: commitIdentityDomain('sunrey.human-economic.sybil.graph.v1', {
          relatedCount: input.relatedActorIds.length,
        }),
      }),
    );
  }

  for (const suggestion of input.aiPatternSuggestions) {
    signals.push(
      signal(input.humanActorId, suggestion.kind, suggestion.severity, input.evaluatedAt, {
        relatedActorIds: suggestion.relatedActorIds,
        evidenceCommitment: suggestion.evidenceCommitment,
        aiSuggested: true,
      }),
    );
  }

  const frozenSignals = Object.freeze(signals);
  return Object.freeze({
    humanActorId: input.humanActorId,
    signals: frozenSignals,
    policyOutcome: aggregateOutcome(frozenSignals),
    autonomousBan: false,
    evaluatedAt: input.evaluatedAt,
  });
}
