import type {
  ResearchMonitorEvaluation,
  ResearchMonitorManifest,
  ResearchMonitorState,
  ResearchMonitorStoreSnapshot,
  ResearchMonitorTriggerEvent,
} from './types.ts';
import type { ResearchMonitorId } from './ids.ts';

export class InMemoryResearchMonitorStore {
  readonly #states = new Map<string, ResearchMonitorState>();
  readonly #manifests = new Map<string, ResearchMonitorManifest>();
  readonly #triggers = new Map<string, ResearchMonitorTriggerEvent>();
  readonly #evaluations: ResearchMonitorEvaluation[] = [];
  #evaluationSequence = 0;

  registerManifest(manifest: ResearchMonitorManifest): void {
    this.#manifests.set(manifest.manifestId, manifest);
    if (!this.#states.has(manifest.monitorId)) {
      this.#states.set(
        manifest.monitorId,
        Object.freeze({
          monitorId: manifest.monitorId,
          runtimeStatus: 'NOT_STARTED',
          triggerCount: 0,
          lastTriggeredAt: null,
          lastEvaluationAt: null,
          lastTriggerFingerprint: null,
          budgetReservedMinor: '0',
          manifestId: manifest.manifestId,
        }),
      );
    }
  }

  getState(monitorId: ResearchMonitorId): ResearchMonitorState | null {
    return this.#states.get(monitorId) ?? null;
  }

  putState(state: ResearchMonitorState): void {
    this.#states.set(state.monitorId, Object.freeze({ ...state }));
  }

  putTrigger(trigger: ResearchMonitorTriggerEvent): void {
    this.#triggers.set(trigger.triggerEventId, trigger);
  }

  hasTriggerFingerprint(monitorId: ResearchMonitorId, fingerprint: string): boolean {
    for (const trigger of this.#triggers.values()) {
      if (trigger.monitorId === monitorId && trigger.fingerprint === fingerprint) {
        return true;
      }
    }
    return false;
  }

  putEvaluation(evaluation: ResearchMonitorEvaluation): void {
    this.#evaluations.push(evaluation);
  }

  nextEvaluationSequence(): number {
    this.#evaluationSequence += 1;
    return this.#evaluationSequence;
  }

  snapshot(): ResearchMonitorStoreSnapshot {
    return Object.freeze({
      states: Object.freeze([...this.#states.values()]),
      triggers: Object.freeze([...this.#triggers.values()]),
      evaluations: Object.freeze([...this.#evaluations]),
      manifests: Object.freeze([...this.#manifests.values()]),
    });
  }

  loadSnapshot(snapshot: ResearchMonitorStoreSnapshot): void {
    this.#states.clear();
    this.#manifests.clear();
    this.#triggers.clear();
    this.#evaluations.length = 0;
    for (const manifest of snapshot.manifests) {
      this.#manifests.set(manifest.manifestId, manifest);
    }
    for (const state of snapshot.states) {
      this.#states.set(state.monitorId, state);
    }
    for (const trigger of snapshot.triggers) {
      this.#triggers.set(trigger.triggerEventId, trigger);
    }
    for (const evaluation of snapshot.evaluations) {
      this.#evaluations.push(evaluation);
    }
    this.#evaluationSequence = snapshot.evaluations.length;
  }
}
