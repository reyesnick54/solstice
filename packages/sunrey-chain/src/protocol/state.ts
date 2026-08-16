import type { ActorDescriptor } from './actor.ts';
import type { EconomicObject } from './economic-object.ts';
import type { RightObject } from './rights.ts';

export type ProtocolEvent = {
  readonly kind: string;
  readonly transactionId: string;
  readonly family: string;
  readonly objectId: string | null;
  readonly chainBalanceAuthoritative: false;
  readonly ledgerSupplyChanged: false;
};

export type StateTransitionResult = {
  readonly accepted: true;
  readonly transactionId: string;
  readonly events: readonly ProtocolEvent[];
};

export type ProtocolExecutionContext = {
  readonly networkId: string;
  readonly chainId: string;
  readonly blockTimeUnixSeconds: bigint;
};

export class ProtocolState {
  private readonly actors = new Map<string, ActorDescriptor>();
  private readonly sequences = new Map<string, bigint>();
  private readonly transactionIds = new Set<string>();
  private readonly idempotencyKeys = new Set<string>();
  private readonly rights = new Map<string, RightObject>();
  private readonly objects = new Map<string, EconomicObject>();
  private readonly capacities = new Map<string, bigint>();
  private readonly knownPolicies = new Set<string>();
  private readonly knownConsents = new Set<string>();

  registerActor(actor: ActorDescriptor): void {
    this.actors.set(actor.actorId, actor);
  }

  actorOf(actorId: string): ActorDescriptor | undefined {
    return this.actors.get(actorId);
  }

  lastSequence(actorId: string): bigint {
    return this.sequences.get(actorId) ?? 0n;
  }

  hasTransactionId(transactionId: string): boolean {
    return this.transactionIds.has(transactionId);
  }

  hasIdempotencyKey(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }

  grantRight(right: RightObject): void {
    this.rights.set(right.rightId, right);
  }

  rightOf(rightId: string): RightObject | undefined {
    return this.rights.get(rightId);
  }

  heldRights(holderId: string): readonly RightObject[] {
    return [...this.rights.values()]
      .filter((right) => right.holderId === holderId)
      .sort((left, right) => (left.rightId < right.rightId ? -1 : 1));
  }

  putObject(object: EconomicObject): void {
    this.objects.set(object.objectId, object);
  }

  objectOf(objectId: string): EconomicObject | undefined {
    return this.objects.get(objectId);
  }

  setCapacity(objectId: string, units: bigint): void {
    this.capacities.set(objectId, units);
  }

  capacityOf(objectId: string): bigint {
    return this.capacities.get(objectId) ?? 0n;
  }

  allowPolicy(policyRef: string): void {
    this.knownPolicies.add(policyRef);
  }

  hasPolicy(policyRef: string): boolean {
    return this.knownPolicies.has(policyRef);
  }

  allowConsent(consentRef: string): void {
    this.knownConsents.add(consentRef);
  }

  hasConsent(consentRef: string): boolean {
    return this.knownConsents.has(consentRef);
  }

  recordAccepted(input: {
    readonly actorId: string;
    readonly sequence: bigint;
    readonly transactionId: string;
    readonly idempotencyKey: string;
  }): void {
    this.sequences.set(input.actorId, input.sequence);
    this.transactionIds.add(input.transactionId);
    if (input.idempotencyKey.length > 0) {
      this.idempotencyKeys.add(input.idempotencyKey);
    }
  }

  snapshotIds(): readonly string[] {
    return [...this.transactionIds].sort();
  }
}
