// @ts-nocheck
import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { BundleAuthorizationPort } from '../ports/authorization.ts';
import type { CapacityProviderPort } from '../ports/capacity-provider.ts';
import type { ExperienceBundle, BundleComponent } from '../types/experience-bundle.ts';
import { freezeAccessRight } from '../types/access-right.ts';

export type SagaStepResult =
  | { readonly outcome: 'ADVANCED'; readonly bundle: ExperienceBundle }
  | { readonly outcome: 'WAITING_APPROVAL'; readonly bundle: ExperienceBundle; readonly detail: string }
  | { readonly outcome: 'COMPLETED'; readonly bundle: ExperienceBundle }
  | { readonly outcome: 'FAILED'; readonly bundle: ExperienceBundle; readonly detail: string };

function addMinutes(instant: UtcInstant, minutes: number): UtcInstant {
  return new Date(Date.parse(instant) + minutes * 60_000).toISOString() as UtcInstant;
}

function updateComponent(
  bundle: ExperienceBundle,
  componentId: string,
  patch: Partial<BundleComponent>,
): ExperienceBundle {
  const components = bundle.components.map((component) =>
    component.componentId === componentId ? Object.freeze({ ...component, ...patch }) : component,
  );
  return Object.freeze({ ...bundle, components: Object.freeze(components), updatedAt: bundle.updatedAt });
}

function sealWorkflow(bundle: ExperienceBundle, vault: EvidenceVault, kind: string, payload: unknown): ExperienceBundle {
  const record = vault.seal(kind, payload);
  return Object.freeze({
    ...bundle,
    workflowEvidenceIds: Object.freeze([...bundle.workflowEvidenceIds, record.evidenceId]),
  });
}

function orderedComponents(bundle: ExperienceBundle): readonly BundleComponent[] {
  const pending = [...bundle.components];
  const ordered: BundleComponent[] = [];
  while (pending.length > 0) {
    const next = pending.find((component) =>
      component.dependsOn.every((dep) => ordered.some((done) => done.componentId === dep)),
    );
    if (!next) {
      throw new Error('component dependency cycle detected');
    }
    ordered.push(next);
    pending.splice(pending.indexOf(next), 1);
  }
  return ordered;
}

export class ExperienceBundleSaga {
  private readonly capacity: CapacityProviderPort;
  private readonly authorization: BundleAuthorizationPort;
  private readonly vault: EvidenceVault;
  private readonly now: () => UtcInstant;

  constructor(input: {
    readonly capacity: CapacityProviderPort;
    readonly authorization: BundleAuthorizationPort;
    readonly vault: EvidenceVault;
    readonly now: () => UtcInstant;
  }) {
    this.capacity = input.capacity;
    this.authorization = input.authorization;
    this.vault = input.vault;
    this.now = input.now;
  }

  authorize(input: { readonly bundle: ExperienceBundle; readonly confirmedBy: string }): SagaStepResult {
    if (!input.bundle.confirmedBy || input.bundle.userApprovals.length === 0) {
      let bundle = Object.freeze({
        ...input.bundle,
        completionState: 'FAILED' as const,
        updatedAt: this.now(),
      });
      bundle = sealWorkflow(bundle, this.vault, 'access.bundle.authorization.refused', {
        bundleId: bundle.bundleId,
        code: 'UNAUTHORIZED',
        detail: 'bundle requires human confirmation before authorization',
      });
      return { outcome: 'FAILED', bundle, detail: 'bundle requires human confirmation before authorization' };
    }
    if (input.confirmedBy !== input.bundle.confirmedBy) {
      let bundle = Object.freeze({
        ...input.bundle,
        completionState: 'FAILED' as const,
        updatedAt: this.now(),
      });
      bundle = sealWorkflow(bundle, this.vault, 'access.bundle.authorization.refused', {
        bundleId: bundle.bundleId,
        code: 'UNAUTHORIZED',
        detail: 'confirmedBy does not match bundle confirmation',
      });
      return { outcome: 'FAILED', bundle, detail: 'confirmedBy does not match bundle confirmation' };
    }
    let bundle = Object.freeze({
      ...input.bundle,
      completionState: 'AWAITING_USER_APPROVAL' as const,
      updatedAt: this.now(),
    });
    const decision = this.authorization.authorizeBundle({
      bundle,
      confirmedBy: input.confirmedBy,
      humanApproved: true,
    });
    if (!decision.ok) {
      bundle = sealWorkflow(
        Object.freeze({ ...bundle, completionState: 'FAILED' }),
        this.vault,
        'access.bundle.authorization.refused',
        { bundleId: bundle.bundleId, code: decision.code, detail: decision.detail },
      );
      return { outcome: 'FAILED', bundle, detail: decision.detail };
    }
    bundle = Object.freeze({
      ...bundle,
      completionState: 'AUTHORIZED',
      authorizationEvidenceId: decision.evidenceId,
      updatedAt: this.now(),
    });
    bundle = sealWorkflow(bundle, this.vault, 'access.bundle.authorized', {
      bundleId: bundle.bundleId,
      authorizationId: decision.authorizationId,
    });
    return { outcome: 'ADVANCED', bundle };
  }

  async reserveAll(bundle: ExperienceBundle): Promise<SagaStepResult> {
    let current = Object.freeze({ ...bundle, completionState: 'RESERVING' as const, updatedAt: this.now() });
    const failures: { readonly componentId: string; readonly detail: string }[] = [];
    const committedHolds: string[] = [];

    for (const component of orderedComponents(current)) {
      const spec = bundle.components.find((row) => row.componentId === component.componentId)!;
      const holdResult = await this.capacity.holdCapacity({
        providerId: component.providerId,
        resourceKind: component.resourceKind,
        quantity: component.entitlementConsumption,
        unit: component.unit,
        holdExpiresAt: addMinutes(this.now(), 30),
        idempotencyKey: `${bundle.bundleId}:${component.componentId}`,
      });
      if (!holdResult.ok) {
        failures.push({ componentId: component.componentId, detail: holdResult.detail });
        current = updateComponent(current, component.componentId, {
          state: 'FAILED',
          failureReason: holdResult.detail,
        });
        if (component.mandatory === 'MANDATORY' && bundle.failurePolicy === 'ALL_OR_NOTHING') {
          current = await this.compensate(current, committedHolds, 'mandatory component failed under ALL_OR_NOTHING');
          return { outcome: 'FAILED', bundle: current, detail: holdResult.detail };
        }
        continue;
      }
      committedHolds.push(holdResult.reservation.reservationId);
      current = updateComponent(current, component.componentId, {
        state: 'HELD',
        reservation: holdResult.reservation,
        accessRight: freezeAccessRight({
          accessRightId: randomUUID(),
          subjectRef: bundle.subjectRef,
          providerId: component.providerId,
          resourceKind: component.resourceKind,
          scope: Object.freeze({
            componentId: component.componentId,
            windowStart: spec.reservationWindow.start,
            windowEnd: spec.reservationWindow.end,
          }),
          state: 'ACTIVE',
          consumptionLimit: component.entitlementConsumption,
          consumedUnits: 0,
          validFrom: spec.reservationWindow.start,
          validUntil: spec.reservationWindow.end,
          evidenceId: null,
        }),
      });
      current = sealWorkflow(current, this.vault, 'access.bundle.component.held', {
        bundleId: bundle.bundleId,
        componentId: component.componentId,
        reservationId: holdResult.reservation.reservationId,
      });
    }

    if (failures.length > 0) {
      if (bundle.failurePolicy === 'PARTIAL_WITH_APPROVAL') {
        current = Object.freeze({ ...current, completionState: 'PARTIALLY_RESERVED', updatedAt: this.now() });
        return {
          outcome: 'WAITING_APPROVAL',
          bundle: current,
          detail: `partial reservation: ${failures.map((row) => row.componentId).join(', ')}`,
        };
      }
      if (bundle.failurePolicy === 'BEST_EFFORT') {
        current = Object.freeze({ ...current, completionState: 'PARTIALLY_RESERVED', updatedAt: this.now() });
        return { outcome: 'ADVANCED', bundle: current };
      }
    }
    current = Object.freeze({ ...current, completionState: 'RESERVING', updatedAt: this.now() });
    return { outcome: 'ADVANCED', bundle: current };
  }

  async commitAll(bundle: ExperienceBundle): Promise<SagaStepResult> {
    let current = Object.freeze({ ...bundle, completionState: 'COMMITTING' as const, updatedAt: this.now() });
    const committed: string[] = [];
    for (const component of current.components) {
      if (component.state !== 'HELD' || !component.reservation) {
        if (component.mandatory === 'OPTIONAL' && component.state === 'FAILED') {
          current = updateComponent(current, component.componentId, { state: 'SKIPPED' });
        }
        continue;
      }
      const reservation = await this.capacity.commitReservation(component.reservation.reservationId);
      committed.push(reservation.reservationId);
      current = updateComponent(current, component.componentId, {
        state: 'COMMITTED',
        reservation,
        accessRight: component.accessRight
          ? freezeAccessRight({ ...component.accessRight, state: 'ACTIVE' })
          : null,
      });
      current = sealWorkflow(current, this.vault, 'access.bundle.component.committed', {
        bundleId: bundle.bundleId,
        componentId: component.componentId,
        reservationId: reservation.reservationId,
      });
    }
    const allMandatoryCommitted = current.components
      .filter((component) => component.mandatory === 'MANDATORY')
      .every((component) => component.state === 'COMMITTED');
    const anyCommitted = current.components.some((component) => component.state === 'COMMITTED');
    const completionState = allMandatoryCommitted
      ? 'COMPLETED'
      : anyCommitted
        ? 'PARTIALLY_COMPLETED'
        : 'FAILED';
    current = Object.freeze({ ...current, completionState, updatedAt: this.now() });
    current = sealWorkflow(current, this.vault, 'access.bundle.completed', {
      bundleId: bundle.bundleId,
      completionState,
    });
    return completionState === 'FAILED'
      ? { outcome: 'FAILED', bundle: current, detail: 'no components committed' }
      : { outcome: 'COMPLETED', bundle: current };
  }

  async approvePartial(input: {
    readonly bundle: ExperienceBundle;
    readonly approvedBy: string;
    readonly approvedComponentIds: readonly string[];
  }): Promise<SagaStepResult> {
    if (input.bundle.failurePolicy !== 'PARTIAL_WITH_APPROVAL') {
      throw new Error('partial approval only applies to PARTIAL_WITH_APPROVAL policy');
    }
    const approval = Object.freeze({
      approvalId: randomUUID(),
      approvedBy: input.approvedBy,
      approvedAt: this.now(),
      scope: 'PARTIAL_COMPLETION' as const,
      approvedComponentIds: Object.freeze([...input.approvedComponentIds]),
    });
    let bundle = Object.freeze({
      ...input.bundle,
      userApprovals: Object.freeze([...input.bundle.userApprovals, approval]),
      updatedAt: this.now(),
    });
    const skipped = bundle.components
      .filter((component) => component.state === 'FAILED')
      .map((component) => component.componentId);
    for (const componentId of skipped) {
      bundle = updateComponent(bundle, componentId, { state: 'SKIPPED' });
    }
    return this.commitAll(bundle);
  }

  async run(input: {
    readonly bundle: ExperienceBundle;
    readonly confirmedBy: string;
  }): Promise<SagaStepResult> {
    const authorized = this.authorize(input);
    if (authorized.outcome === 'FAILED') {
      return authorized;
    }
    const reserved = await this.reserveAll(authorized.bundle);
    if (reserved.outcome === 'FAILED') {
      return reserved;
    }
    if (reserved.outcome === 'WAITING_APPROVAL') {
      return reserved;
    }
    return this.commitAll(reserved.bundle);
  }

  private async compensate(
    bundle: ExperienceBundle,
    holdIds: readonly string[],
    reason: string,
  ): Promise<ExperienceBundle> {
    let current = Object.freeze({ ...bundle, completionState: 'COMPENSATING' as const, updatedAt: this.now() });
    for (const reservationId of holdIds) {
      await this.capacity.releaseReservation(reservationId);
      current = sealWorkflow(current, this.vault, 'access.bundle.hold.released', {
        bundleId: bundle.bundleId,
        reservationId,
        reason,
      });
    }
    current = Object.freeze({ ...current, completionState: 'FAILED', updatedAt: this.now() });
    return sealWorkflow(current, this.vault, 'access.bundle.compensated', { bundleId: bundle.bundleId, reason });
  }

}
