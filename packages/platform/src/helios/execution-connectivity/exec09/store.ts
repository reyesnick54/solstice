import type {
  ExternalTradeConfirmation,
  Exec09SettlementStoreSnapshot,
  SettlementCorrection,
  SettlementFailure,
  SettlementInstruction,
  SettlementLeg,
  SettlementLifecycle,
  SettlementObligation,
  VersionedSettlementPolicy,
} from './types.ts';
import type { Exec09SettlementLifecycleId, Exec09SettlementObligationId } from './ids.ts';
import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';

export class InMemoryExec09SettlementStore {
  private readonly policies = new Map<string, VersionedSettlementPolicy>();
  private readonly confirmations = new Map<string, ExternalTradeConfirmation>();
  private readonly instructions = new Map<string, SettlementInstruction>();
  private readonly obligations = new Map<Exec09SettlementObligationId, SettlementObligation>();
  private readonly lifecycles = new Map<Exec09SettlementLifecycleId, SettlementLifecycle>();
  private readonly failures = new Map<string, SettlementFailure>();
  private readonly corrections = new Map<string, SettlementCorrection>();
  private readonly legs = new Map<string, SettlementLeg>();
  private readonly fillToObligation = new Map<HeliosFillId, Exec09SettlementObligationId>();

  constructor(seed?: Partial<Exec09SettlementStoreSnapshot>) {
    if (seed?.policies) {
      for (const policy of seed.policies) {
        this.policies.set(`${policy.policyId}:${policy.version}`, policy);
      }
    }
  }

  putPolicy(policy: VersionedSettlementPolicy): void {
    this.policies.set(`${policy.policyId}:${policy.version}`, policy);
  }

  listPolicies(): readonly VersionedSettlementPolicy[] {
    return Object.freeze([...this.policies.values()]);
  }

  putConfirmation(confirmation: ExternalTradeConfirmation): void {
    this.confirmations.set(confirmation.confirmationId, confirmation);
  }

  getConfirmation(confirmationId: string): ExternalTradeConfirmation | null {
    return this.confirmations.get(confirmationId) ?? null;
  }

  putInstruction(instruction: SettlementInstruction): void {
    this.instructions.set(instruction.instructionId, instruction);
  }

  putObligation(obligation: SettlementObligation): void {
    this.obligations.set(obligation.obligationId, obligation);
    this.fillToObligation.set(obligation.fillId, obligation.obligationId);
  }

  getObligation(obligationId: Exec09SettlementObligationId): SettlementObligation | null {
    return this.obligations.get(obligationId) ?? null;
  }

  getObligationByFill(fillId: HeliosFillId): SettlementObligation | null {
    const id = this.fillToObligation.get(fillId);
    return id ? (this.obligations.get(id) ?? null) : null;
  }

  listObligationsForLifecycle(lifecycleId: Exec09SettlementLifecycleId): readonly SettlementObligation[] {
    return Object.freeze([...this.obligations.values()].filter((item) => item.lifecycleId === lifecycleId));
  }

  putLifecycle(lifecycle: SettlementLifecycle): void {
    this.lifecycles.set(lifecycle.lifecycleId, lifecycle);
  }

  getLifecycle(lifecycleId: Exec09SettlementLifecycleId): SettlementLifecycle | null {
    return this.lifecycles.get(lifecycleId) ?? null;
  }

  getLifecycleByOrder(orderId: HeliosOrderId): SettlementLifecycle | null {
    for (const lifecycle of this.lifecycles.values()) {
      if (lifecycle.orderId === orderId) {
        return lifecycle;
      }
    }
    return null;
  }

  putFailure(failure: SettlementFailure): void {
    this.failures.set(failure.failureId, failure);
  }

  putCorrection(correction: SettlementCorrection): void {
    this.corrections.set(correction.correctionId, correction);
  }

  putLeg(leg: SettlementLeg): void {
    this.legs.set(leg.legId, leg);
  }

  getLeg(legId: string): SettlementLeg | null {
    return this.legs.get(legId) ?? null;
  }

  snapshot(): Exec09SettlementStoreSnapshot {
    return Object.freeze({
      policies: Object.freeze([...this.policies.values()]),
      confirmations: Object.freeze([...this.confirmations.values()]),
      instructions: Object.freeze([...this.instructions.values()]),
      obligations: Object.freeze([...this.obligations.values()]),
      lifecycles: Object.freeze([...this.lifecycles.values()]),
      failures: Object.freeze([...this.failures.values()]),
      corrections: Object.freeze([...this.corrections.values()]),
      legs: Object.freeze([...this.legs.values()]),
    });
  }
}
