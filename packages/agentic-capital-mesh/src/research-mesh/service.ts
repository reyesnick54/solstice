import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock, type UtcInstant } from '../imports.ts';
import { DEFAULT_MESH_BUDGET_LIMITS, ResearchMeshBudgetController } from './budget.ts';
import { buildMetaAllocatorOutput } from './meta-allocator.ts';
import { nodeSpecForRole } from './nodes.ts';
import { routeSpecialistModel } from './model-routing.ts';
import { routeSpecialistTasks, shouldInvokeRole } from './routing.ts';
import { executeSpecialistTask, type SpecialistExecutionResult } from './specialists.ts';
import { ResearchMeshStore } from './store.ts';
import { validateSpecialistTaskOutput } from './validation.ts';
import type {
  EvidenceReference,
  HeliosSpecialistRole,
  MeshCompletionState,
  MetaAllocatorOutput,
  OpportunityKind,
  PrivacyClass,
  ResearchMeshBudgetLimits,
  ResearchMeshFailure,
  ResearchMeshRun,
  SpecialistTaskInput,
  SpecialistTaskOutput,
} from './types.ts';

export type ResearchMeshRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly opportunityKind: OpportunityKind;
  readonly privacyClass: PrivacyClass;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly customerPrivateContext?: readonly string[];
  readonly claims?: readonly { readonly claimId: string; readonly statement: string; readonly evidenceIds: readonly string[] }[];
  readonly forceRoleFailure?: HeliosSpecialistRole;
  readonly forceRoleTimeout?: HeliosSpecialistRole;
};

export type ResearchMeshResult = {
  readonly run: ResearchMeshRun;
  readonly outputs: readonly SpecialistTaskOutput[];
  readonly meta: MetaAllocatorOutput;
  readonly invokedRoles: readonly HeliosSpecialistRole[];
  readonly skippedRoles: readonly HeliosSpecialistRole[];
};

function hashId(prefix: string, material: string): string {
  return `${prefix}${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

export class SpecialistResearchMesh {
  readonly store: ResearchMeshStore;
  private readonly clock: Clock;
  private readonly budget: ResearchMeshBudgetController;
  private readonly limits: ResearchMeshBudgetLimits;
  private readonly cancelledRuns = new Set<string>();

  constructor(input: {
    readonly clock: Clock;
    readonly store?: ResearchMeshStore;
    readonly budget?: ResearchMeshBudgetController;
    readonly limits?: ResearchMeshBudgetLimits;
  }) {
    this.clock = input.clock;
    this.store = input.store ?? new ResearchMeshStore();
    this.limits = input.limits ?? DEFAULT_MESH_BUDGET_LIMITS;
    this.budget = input.budget ?? new ResearchMeshBudgetController(this.limits);
  }

  cancelRun(runId: string): Result<true, ResearchMeshFailure> {
    const run = this.store.getRun(runId);
    if (!run) {
      return err({ code: 'RUN_NOT_FOUND', message: 'research mesh run not found' });
    }
    this.cancelledRuns.add(runId);
    this.store.putRun(
      Object.freeze({
        ...run,
        cancelled: true,
        updatedAt: this.clock.now(),
        completionState: 'PARTIAL',
      }),
    );
    return ok(true);
  }

  runResearch(request: ResearchMeshRequest): Result<ResearchMeshResult, ResearchMeshFailure> {
    const now = this.clock.now();
    const runId = hashId('cmrm_', `${request.workOrderId}:${request.subjectId}:${now}`);
    const routedRoles = routeSpecialistTasks(request.opportunityKind);
    const skippedRoles = Object.freeze(
      (['OPPORTUNITY_RESEARCH', 'MACRO_FX', 'STAT_ARB_RELATIVE_VALUE', 'VOLATILITY', 'MICROSTRUCTURE', 'EXECUTION_RESEARCH', 'EVIDENCE_VERIFIER', 'ADVERSARIAL_CRITIC', 'META_ALLOCATOR'] as const).filter(
        (role) => !shouldInvokeRole(role, request.opportunityKind),
      ),
    );

    const run: ResearchMeshRun = Object.freeze({
      runId,
      workOrderId: request.workOrderId,
      subjectId: request.subjectId,
      opportunityKind: request.opportunityKind,
      privacyClass: request.privacyClass,
      routedRoles,
      completionState: 'COMPLETE',
      createdAt: now,
      updatedAt: now,
      cancelled: false,
    });
    this.store.putRun(run);

    const outputs: SpecialistTaskOutput[] = [];
    const failedRoles: HeliosSpecialistRole[] = [];
    const timedOutRoles: HeliosSpecialistRole[] = [];
    const cancelledRoles: HeliosSpecialistRole[] = [];
    const invokedRoles: HeliosSpecialistRole[] = [];

    for (const role of routedRoles) {
      if (role === 'META_ALLOCATOR') {
        continue;
      }
      if (this.cancelledRuns.has(runId)) {
        cancelledRoles.push(role);
        continue;
      }

      const spec = nodeSpecForRole(role);
      const reserveAmount = spec.researchBudgetCeilingMicros > this.limits.specialistCeilingMicros
        ? this.limits.specialistCeilingMicros
        : spec.researchBudgetCeilingMicros;
      const taskId = hashId('cmtask_', `${runId}:${role}`);
      const reserved = this.budget.reserve({
        workOrderId: request.workOrderId,
        taskId,
        amountMicros: reserveAmount,
      });
      if (!reserved.ok) {
        return err(reserved.error);
      }

      const route = routeSpecialistModel({ role, privacyClass: request.privacyClass });
      if (!route.ok) {
        this.budget.reconcile({
          workOrderId: request.workOrderId,
          reservationRef: reserved.value.reservationRef,
          actualMicros: 0n,
          cancelled: true,
        });
        return err(route.error);
      }

      const startedAt = this.clock.now();
      const task: SpecialistTaskInput = Object.freeze({
        taskId,
        workOrderId: request.workOrderId,
        subjectId: request.subjectId,
        role,
        objective: request.objective,
        opportunityKind: request.opportunityKind,
        privacyClass: request.privacyClass,
        contextRef: request.contextRef,
        deadlineAt: startedAt,
        approvedTools: spec.approvedTools,
        evidenceBundle: request.evidenceBundle,
        priorOutputs: Object.freeze([...outputs]),
        ...(request.customerPrivateContext ? { customerPrivateContext: request.customerPrivateContext } : {}),
      });

      const execution = executeSpecialistTask({
        task,
        route: route.value,
        startedAt,
        completedAt: this.clock.now(),
        ...(request.claims ? { claims: request.claims } : {}),
        forceFailure: request.forceRoleFailure === role,
        forceTimeout: request.forceRoleTimeout === role,
      });

      invokedRoles.push(role);
      this.finalizeTask({
        role,
        request,
        reservedRef: reserved.value.reservationRef,
        execution,
        outputs,
        failedRoles,
        timedOutRoles,
      });
    }

    const meta = buildMetaAllocatorOutput({
      runId,
      routedRoles,
      outputs,
      failedRoles,
      timedOutRoles,
      cancelledRoles,
    });
    this.store.putMetaOutput(meta);

    const completionState: MeshCompletionState = meta.completionState;
    this.store.putRun(
      Object.freeze({
        ...run,
        completionState,
        updatedAt: this.clock.now(),
        cancelled: cancelledRoles.length > 0,
      }),
    );
    this.store.putBudgetSnapshot(this.budget.snapshot(request.workOrderId));

    return ok(
      Object.freeze({
        run: Object.freeze({ ...run, completionState, cancelled: cancelledRoles.length > 0 }),
        outputs: Object.freeze([...outputs]),
        meta,
        invokedRoles: Object.freeze([...invokedRoles]),
        skippedRoles,
      }),
    );
  }

  restoreFromSnapshot(snapshot: ReturnType<ResearchMeshStore['snapshot']>): void {
    this.store.restore(snapshot);
    for (const budget of snapshot.budgetSnapshots) {
      this.budget.restore(budget.workOrderId, budget);
    }
  }

  private finalizeTask(input: {
    readonly role: HeliosSpecialistRole;
    readonly request: ResearchMeshRequest;
    readonly reservedRef: string;
    readonly execution: SpecialistExecutionResult;
    readonly outputs: SpecialistTaskOutput[];
    readonly failedRoles: HeliosSpecialistRole[];
    readonly timedOutRoles: HeliosSpecialistRole[];
  }): void {
    if (!input.execution.ok) {
      if (input.execution.state === 'TIMED_OUT') {
        input.timedOutRoles.push(input.role);
      } else if (input.execution.state !== 'SKIPPED') {
        input.failedRoles.push(input.role);
      }
      this.budget.reconcile({
        workOrderId: input.request.workOrderId,
        reservationRef: input.reservedRef,
        actualMicros: 0n,
        cancelled: true,
      });
      return;
    }

    const validationErrors = validateSpecialistTaskOutput(input.execution.output);
    if (validationErrors.length > 0) {
      input.failedRoles.push(input.execution.output.specialistRole);
      this.budget.reconcile({
        workOrderId: input.request.workOrderId,
        reservationRef: input.reservedRef,
        actualMicros: 0n,
        cancelled: true,
      });
      return;
    }

    input.outputs.push(input.execution.output);
    this.store.putTaskOutput(input.execution.output);
    this.budget.reconcile({
      workOrderId: input.request.workOrderId,
      reservationRef: input.reservedRef,
      actualMicros: input.execution.output.usage.costMicros,
    });
  }
}
