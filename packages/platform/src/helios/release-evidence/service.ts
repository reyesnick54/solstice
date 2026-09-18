/**
 * HELIOS H36 — release evidence and live-pilot gate service.
 */

import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { buildPilotActivationCeremonyContract } from './activation-ceremony.ts';
import { buildLivePilotAuthorization, refuseAiAuthorization } from './authorization.ts';
import { buildHeliosClosureReport } from './closure-report.ts';
import { buildHeliosReleaseEvidencePackage, type BuildReleaseEvidenceInput } from './evidence-builder.ts';
import {
  sealHeliosClosureReport,
  sealHeliosReleaseEvidencePackage,
  sealLivePilotAuthorizationRecord,
  sealLivePilotGateEvaluation,
} from './evidence.ts';
import { livePilotScopeIdFor, type HeliosReleaseId } from './ids.ts';
import {
  applyGateItemUpdate,
  createDefaultLivePilotGateItems,
  evaluateLivePilotGate,
  refuseAiGateSatisfaction,
} from './live-pilot-gate.ts';
import { evaluateReleaseCandidateQualification } from './qualification.ts';
import { InMemoryReleaseEvidenceStore } from './store.ts';
import type {
  ExternalEvidenceRef,
  GovernanceApproverRecord,
  LivePilotAuthorization,
  LivePilotGate,
  LivePilotScope,
  ReleaseCandidateQualificationResult,
} from './types.ts';

export type HeliosReleaseEvidencePorts = {
  readonly store: InMemoryReleaseEvidenceStore;
  readonly vault?: EvidenceVault;
  readonly repoRoot: string;
};

export class HeliosReleaseEvidenceService {
  readonly #ports: HeliosReleaseEvidencePorts;

  constructor(ports: HeliosReleaseEvidencePorts) {
    this.#ports = ports;
  }

  buildReleaseEvidence(input: BuildReleaseEvidenceInput) {
    const pkg = buildHeliosReleaseEvidencePackage(input);
    this.#ports.store.savePackage(pkg);
    sealHeliosReleaseEvidencePackage(this.#ports.vault, pkg);
    return pkg;
  }

  initializeLivePilotGate(input: {
    readonly scope: LivePilotScope;
    readonly releaseGitSha: string;
    readonly releaseId: HeliosReleaseId;
    readonly evaluatedAt: UtcInstant;
  }): LivePilotGate {
    const items = createDefaultLivePilotGateItems(input.evaluatedAt);
    const gate = evaluateLivePilotGate({
      scope: input.scope,
      releaseId: input.releaseId,
      releaseGitSha: input.releaseGitSha,
      items,
      evaluatedAt: input.evaluatedAt,
    });
    this.#ports.store.saveGate(gate);
    sealLivePilotGateEvaluation(this.#ports.vault, gate);
    return gate;
  }

  updateGateItem(input: {
    readonly gate: LivePilotGate;
    readonly itemKey: string;
    readonly nextState: import('./taxonomy.ts').LivePilotGateState;
    readonly evidenceRefs?: readonly ExternalEvidenceRef[];
    readonly actorKind: 'AI' | 'HUMAN' | 'SERVICE';
    readonly actorIsAuthorizedGovernance: boolean;
    readonly updatedAt: UtcInstant;
  }): LivePilotGate {
    const item = input.gate.items.find((row) => row.itemKey === input.itemKey);
    if (!item) {
      throw new TypeError(`gate item not found: ${input.itemKey}`);
    }
    refuseAiGateSatisfaction({
      actorKind: input.actorKind,
      nextState: input.nextState,
      requiresExternalEvidence: item.requiresExternalEvidence,
    });
    const updatedItems = input.gate.items.map((row) =>
      row.itemKey === input.itemKey
        ? applyGateItemUpdate(row, {
            nextState: input.nextState,
            evidenceRefs: input.evidenceRefs,
            actorIsAuthorizedGovernance: input.actorIsAuthorizedGovernance,
            updatedAt: input.updatedAt,
          })
        : row,
    );
    const gate = evaluateLivePilotGate({
      scope: input.gate.scope,
      releaseId: input.gate.releaseId,
      releaseGitSha: input.gate.releaseGitSha,
      items: updatedItems,
      evaluatedAt: input.updatedAt,
    });
    this.#ports.store.saveGate(gate);
    sealLivePilotGateEvaluation(this.#ports.vault, gate);
    return gate;
  }

  evaluateReleaseCandidate(input: {
    readonly releaseEvidence: ReturnType<typeof buildHeliosReleaseEvidencePackage>;
    readonly livePilotGate?: LivePilotGate | null;
  }): ReleaseCandidateQualificationResult {
    return evaluateReleaseCandidateQualification(input);
  }

  issueHumanPilotAuthorization(input: {
    readonly actorKind: 'AI' | 'HUMAN' | 'SERVICE';
    readonly seed: string;
    readonly pilotScope: LivePilotScope;
    readonly releaseId: LivePilotGate['releaseId'];
    readonly releaseGitSha: string;
    readonly externalGateStatus: string;
    readonly approvers: readonly GovernanceApproverRecord[];
    readonly approvedAt: UtcInstant;
    readonly effectiveFrom: UtcInstant;
    readonly expiresAt: UtcInstant;
    readonly evidenceRefs: readonly ExternalEvidenceRef[];
    readonly abortConditions: LivePilotAuthorization['abortConditions'];
  }): LivePilotAuthorization {
    refuseAiAuthorization(input.actorKind);
    const authorization = buildLivePilotAuthorization(input);
    this.#ports.store.saveAuthorization(authorization);
    sealLivePilotAuthorizationRecord(this.#ports.vault, authorization);
    return authorization;
  }

  buildClosureReport(input: {
    readonly generatedAt: UtcInstant;
    readonly releaseEvidence: ReturnType<typeof buildHeliosReleaseEvidencePackage>;
    readonly qualification: ReleaseCandidateQualificationResult;
    readonly livePilotGate?: LivePilotGate | null;
  }) {
    const report = buildHeliosClosureReport({
      root: this.#ports.repoRoot,
      generatedAt: input.generatedAt,
      releaseEvidence: input.releaseEvidence,
      qualification: input.qualification,
      livePilotGate: input.livePilotGate ?? null,
    });
    sealHeliosClosureReport(this.#ports.vault, report);
    return report;
  }

  activationCeremonyFor(input: {
    readonly ceremonyId: string;
    readonly releaseId: LivePilotGate['releaseId'];
    readonly scopeId: ReturnType<typeof livePilotScopeIdFor>;
  }) {
    return buildPilotActivationCeremonyContract(input);
  }
}
