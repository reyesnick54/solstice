import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { compileResearchMonitorDefinition } from './compiler.ts';
import { evaluateResearchMonitorExpression } from './evaluate-expression.ts';
import {
  buildFeatureValueMap,
  diagnoseFeatureObservation,
} from './feature-policy.ts';
import {
  sealResearchMonitorEvaluation,
  sealResearchMonitorManifest,
  sealResearchMonitorTrigger,
} from './evidence.ts';
import {
  asResearchMonitorManifestId,
  researchMonitorEvaluationIdFor,
  researchMonitorTriggerEventIdFor,
} from './ids.ts';
import { InMemoryResearchMonitorStore } from './store.ts';
import type {
  ResearchMonitorDefinition,
  ResearchMonitorEvaluateInput,
  ResearchMonitorEvaluation,
  ResearchMonitorManifest,
  ResearchMonitorState,
  ResearchMonitorTriggerEvent,
} from './types.ts';

function instantMs(value: UtcInstant | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function invalidManifestId(monitorId: string): import('./ids.ts').ResearchMonitorManifestId {
  const digest = createHash('sha256').update(`invalid:${monitorId}`, 'utf8').digest('hex').slice(0, 20);
  return asResearchMonitorManifestId(`hrm_mf_invalid_${digest}`);
}

function triggerFingerprint(monitorId: string, featureValues: ReadonlyMap<string, string>): string {
  const body = [...featureValues.entries()].sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify({ monitorId, body }), 'utf8').digest('hex');
}

export type HeliosResearchMonitorServiceOptions = {
  readonly store?: InMemoryResearchMonitorStore;
};

export class HeliosResearchMonitorService {
  readonly #store: InMemoryResearchMonitorStore;

  constructor(options: HeliosResearchMonitorServiceOptions = {}) {
    this.#store = options.store ?? new InMemoryResearchMonitorStore();
  }

  getStore(): InMemoryResearchMonitorStore {
    return this.#store;
  }

  compile(definition: ResearchMonitorDefinition, compiledAt: UtcInstant): ResearchMonitorManifest | null {
    const compiled = compileResearchMonitorDefinition(definition, compiledAt);
    if (!compiled.ok) {
      return null;
    }
    this.#store.registerManifest(compiled.manifest);
    return compiled.manifest;
  }

  evaluate(input: ResearchMonitorEvaluateInput): ResearchMonitorEvaluation {
    const compiled = compileResearchMonitorDefinition(input.definition, input.evaluatedAt);
    const evidenceRefs: string[] = [];
    if (!compiled.ok) {
      return this.#blockedEvaluation(input, null, 'INVALID_DEFINITION', [], evidenceRefs);
    }

    const manifest = compiled.manifest;
    const manifestRef = sealResearchMonitorManifest(input.evidenceVault, manifest);
    if (manifestRef) evidenceRefs.push(manifestRef);
    this.#store.registerManifest(manifest);

    const startMs = instantMs(input.definition.startAt);
    const evalMs = instantMs(input.evaluatedAt);
    if (startMs !== null && evalMs !== null && evalMs < startMs) {
      return this.#blockedEvaluation(input, manifest, 'NOT_STARTED', [], evidenceRefs);
    }
    const expiresMs = instantMs(input.definition.expiresAt);
    if (expiresMs !== null && evalMs !== null && evalMs > expiresMs) {
      return this.#blockedEvaluation(input, manifest, 'EXPIRED', [], evidenceRefs);
    }

    const observations = input.featureFabric.resolveFeatures({
      evaluationTime: input.evaluatedAt,
      featureIds: manifest.featureRefs,
      watch: manifest.watch,
      pointInTimeRequirements: input.definition.pointInTimeFeatureRequirements,
    });

    void input.observationFabric;

    const diagnostics = observations.map((observation) =>
      diagnoseFeatureObservation({
        observation,
        evaluationTime: input.evaluatedAt,
        requirements: input.definition.pointInTimeFeatureRequirements,
      }),
    );

    const policyBlock = buildFeatureValueMap({
      observations,
      diagnostics,
      definition: input.definition,
    });
    if (!policyBlock.ok) {
      return this.#blockedEvaluation(input, manifest, policyBlock.blockReason, diagnostics, evidenceRefs);
    }

    const expr = evaluateResearchMonitorExpression(input.definition.condition.expression, {
      features: policyBlock.values,
    });
    if (!expr.ok) {
      return this.#blockedEvaluation(input, manifest, 'MISSING_FEATURE', diagnostics, evidenceRefs);
    }
    if (!expr.truthy) {
      return this.#recordEvaluation(input, manifest, {
        outcome: 'CONDITION_FALSE',
        blockReason: null,
        conditionMet: false,
        triggerEmitted: false,
        diagnostics,
        triggerEvent: null,
        evidenceRefs,
      });
    }

    const state = this.#store.getState(input.definition.monitorId);
    if (state && state.triggerCount >= input.definition.maxTriggers) {
      return this.#blockedEvaluation(input, manifest, 'MAX_TRIGGERS', diagnostics, evidenceRefs);
    }

    const lastTriggeredMs = instantMs(state?.lastTriggeredAt ?? null);
    if (
      lastTriggeredMs !== null &&
      evalMs !== null &&
      input.definition.cooldownMs > 0 &&
      evalMs - lastTriggeredMs < input.definition.cooldownMs
    ) {
      return this.#blockedEvaluation(input, manifest, 'COOLDOWN', diagnostics, evidenceRefs);
    }

    const fingerprint = triggerFingerprint(input.definition.monitorId, policyBlock.values);
    if (this.#store.hasTriggerFingerprint(input.definition.monitorId, fingerprint)) {
      return this.#blockedEvaluation(input, manifest, 'DUPLICATE_TRIGGER', diagnostics, evidenceRefs);
    }

    const budgetReservation = input.researchBudget.reserveForResearch({
      monitorId: input.definition.monitorId,
      amountMinor: input.definition.researchBudgetMinor,
      evaluatedAt: input.evaluatedAt,
    });
    if (!budgetReservation.ok) {
      return this.#blockedEvaluation(input, manifest, 'RESEARCH_BUDGET_EXHAUSTED', diagnostics, evidenceRefs);
    }

    const triggerEvidence: string[] = [];
    const triggerEvent: ResearchMonitorTriggerEvent = Object.freeze({
      triggerEventId: researchMonitorTriggerEventIdFor(input.definition.monitorId, fingerprint),
      monitorId: input.definition.monitorId,
      manifestId: manifest.manifestId,
      action: 'REQUEST_RESEARCH',
      researchTopic: input.definition.trigger.researchTopic,
      triggeredAt: input.evaluatedAt,
      fingerprint,
      budgetReservedMinor: input.definition.researchBudgetMinor,
      priority: input.definition.priority,
      allowedAgentClasses: Object.freeze([...input.definition.allowedAgentClasses]),
      requiredEvidence: Object.freeze([...input.definition.requiredEvidence]),
      watch: Object.freeze([...manifest.watch]),
      evidenceRefs: Object.freeze([]),
    });

    const triggerRef = sealResearchMonitorTrigger(input.evidenceVault, triggerEvent);
    if (triggerRef) triggerEvidence.push(triggerRef);

    const sealedTrigger: ResearchMonitorTriggerEvent = Object.freeze({
      ...triggerEvent,
      evidenceRefs: Object.freeze([...triggerEvidence]),
    });
    this.#store.putTrigger(sealedTrigger);

    const nextState: ResearchMonitorState = Object.freeze({
      monitorId: input.definition.monitorId,
      runtimeStatus: 'ACTIVE',
      triggerCount: (state?.triggerCount ?? 0) + 1,
      lastTriggeredAt: input.evaluatedAt,
      lastEvaluationAt: input.evaluatedAt,
      lastTriggerFingerprint: fingerprint,
      budgetReservedMinor: (
        BigInt(state?.budgetReservedMinor ?? '0') + BigInt(input.definition.researchBudgetMinor)
      ).toString(),
      manifestId: manifest.manifestId,
    });
    this.#store.putState(nextState);

    return this.#recordEvaluation(input, manifest, {
      outcome: 'TRIGGERED',
      blockReason: null,
      conditionMet: true,
      triggerEmitted: true,
      diagnostics,
      triggerEvent: sealedTrigger,
      evidenceRefs: [...evidenceRefs, ...triggerEvidence],
    });
  }

  #blockedEvaluation(
    input: ResearchMonitorEvaluateInput,
    manifest: ResearchMonitorManifest | null,
    blockReason: import('./taxonomy.ts').ResearchMonitorBlockReason,
    diagnostics: readonly import('./types.ts').FeatureResolutionDiagnostic[],
    evidenceRefs: string[],
  ): ResearchMonitorEvaluation {
    if (manifest) {
      return this.#recordEvaluation(input, manifest, {
        outcome: 'BLOCKED',
        blockReason,
        conditionMet: false,
        triggerEmitted: false,
        diagnostics,
        triggerEvent: null,
        evidenceRefs,
      });
    }
    const evaluationId = researchMonitorEvaluationIdFor(
      input.definition.monitorId,
      input.evaluatedAt,
      this.#store.nextEvaluationSequence(),
    );
    const evaluation: ResearchMonitorEvaluation = Object.freeze({
      evaluationId,
      monitorId: input.definition.monitorId,
      manifestId: invalidManifestId(input.definition.monitorId),
      evaluatedAt: input.evaluatedAt,
      conditionMet: false,
      triggerEmitted: false,
      outcome: 'BLOCKED',
      blockReason,
      featureDiagnostics: Object.freeze([...diagnostics]),
      triggerEvent: null,
      evidenceRefs: Object.freeze([...evidenceRefs]),
      deterministic: true,
    });
    const evalRef = sealResearchMonitorEvaluation(input.evidenceVault, evaluation);
    if (evalRef) evidenceRefs.push(evalRef);
    this.#store.putEvaluation(evaluation);
    return evaluation;
  }

  #recordEvaluation(
    input: ResearchMonitorEvaluateInput,
    manifest: ResearchMonitorManifest,
    payload: {
      readonly outcome: import('./taxonomy.ts').ResearchMonitorEvalOutcome;
      readonly blockReason: import('./taxonomy.ts').ResearchMonitorBlockReason | null;
      readonly conditionMet: boolean;
      readonly triggerEmitted: boolean;
      readonly diagnostics: readonly import('./types.ts').FeatureResolutionDiagnostic[];
      readonly triggerEvent: ResearchMonitorTriggerEvent | null;
      readonly evidenceRefs: readonly string[];
    },
  ): ResearchMonitorEvaluation {
    const evaluationId = researchMonitorEvaluationIdFor(
      input.definition.monitorId,
      input.evaluatedAt,
      this.#store.nextEvaluationSequence(),
    );
    const evaluation: ResearchMonitorEvaluation = Object.freeze({
      evaluationId,
      monitorId: input.definition.monitorId,
      manifestId: manifest.manifestId,
      evaluatedAt: input.evaluatedAt,
      conditionMet: payload.conditionMet,
      triggerEmitted: payload.triggerEmitted,
      outcome: payload.outcome,
      blockReason: payload.blockReason,
      featureDiagnostics: Object.freeze([...payload.diagnostics]),
      triggerEvent: payload.triggerEvent,
      evidenceRefs: Object.freeze([...payload.evidenceRefs]),
      deterministic: true,
    });
    const evalRef = sealResearchMonitorEvaluation(input.evidenceVault, evaluation);
    const refs = evalRef ? [...payload.evidenceRefs, evalRef] : [...payload.evidenceRefs];
    const sealedEval: ResearchMonitorEvaluation = Object.freeze({ ...evaluation, evidenceRefs: Object.freeze(refs) });
    this.#store.putEvaluation(sealedEval);

    if (payload.outcome !== 'TRIGGERED') {
      const prior = this.#store.getState(input.definition.monitorId);
      this.#store.putState(
        Object.freeze({
          monitorId: input.definition.monitorId,
          runtimeStatus:
            payload.blockReason === 'EXPIRED'
              ? 'EXPIRED'
              : payload.blockReason === 'MAX_TRIGGERS'
                ? 'EXHAUSTED'
                : payload.blockReason === 'COOLDOWN'
                  ? 'COOLDOWN'
                  : prior?.runtimeStatus ?? 'ACTIVE',
          triggerCount: prior?.triggerCount ?? 0,
          lastTriggeredAt: prior?.lastTriggeredAt ?? null,
          lastEvaluationAt: input.evaluatedAt,
          lastTriggerFingerprint: prior?.lastTriggerFingerprint ?? null,
          budgetReservedMinor: prior?.budgetReservedMinor ?? '0',
          manifestId: manifest.manifestId,
        }),
      );
    } else {
      const prior = this.#store.getState(input.definition.monitorId);
      if (prior) {
        this.#store.putState(
          Object.freeze({
            ...prior,
            lastEvaluationAt: input.evaluatedAt,
          }),
        );
      }
    }

    return sealedEval;
  }
}
