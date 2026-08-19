import type { RightObject } from '../protocol/rights.ts';
import {
  capacityByCategory,
  contributionLineage,
  epochAggregates,
  geographicAggregates,
  issuanceAttribution,
  outputByCategory,
  queryObject,
  type AttributionView,
  type CategoryAggregate,
  type EpochAggregate,
  type GeographyAggregate,
  type LineageView,
} from './api.ts';
import type { ProductiveClaim } from './claims.ts';
import type { ProductiveCorrection } from './corrections.ts';
import { buildProductiveCapacityGraph, type ProductiveCapacityGraph } from './graph.ts';
import {
  emptyEpoch,
  evaluateIssuance,
  finalizeIssuance,
  recordEpochIssuance,
  type EpochIssuance,
  type MoonReyIssuanceAuthorization,
  type MoonReyIssuanceReceipt,
} from './issuance.ts';
import { categoryUtilization, emptyMetrics, incrementCategory, type ProductiveMetrics } from './metrics.ts';
import { objectIsActive, type ProductiveEconomicObject } from './objects.ts';
import type { OracleFact } from './oracle.ts';
import { developmentIssuancePolicy, policyAtHeight, type MoonReyIssuancePolicy } from './policy.ts';
import { applyIssuance, emptyMoonReySupply, supplyReconciles, type NativeAssetSupplyState } from './supply.ts';
import type { ProductiveRejectionCode } from './types.ts';
import { defaultUnitRegistry, type UnitRegistry } from './units.ts';
import { verifyProductiveClaim, type VerifiedProductiveContribution } from './verification.ts';

export type EngineClock = {
  readonly height: number;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockId: string;
};

export type ProductiveSnapshot = {
  readonly objects: readonly ProductiveEconomicObject[];
  readonly claims: readonly ProductiveClaim[];
  readonly facts: readonly OracleFact[];
  readonly rights: readonly RightObject[];
  readonly contributions: readonly VerifiedProductiveContribution[];
  readonly receipts: readonly MoonReyIssuanceReceipt[];
  readonly corrections: readonly ProductiveCorrection[];
  readonly supply: NativeAssetSupplyState;
  readonly graphHash: string;
};

export class ProductiveEconomyEngine {
  private readonly objects = new Map<string, ProductiveEconomicObject>();
  private readonly claims = new Map<string, ProductiveClaim>();
  private readonly facts = new Map<string, OracleFact>();
  private readonly rights = new Map<string, RightObject>();
  private readonly contributions = new Map<string, VerifiedProductiveContribution>();
  private readonly fingerprints = new Set<string>();
  private readonly issuedFingerprints = new Set<string>();
  private readonly authorizations = new Map<string, MoonReyIssuanceAuthorization>();
  private readonly receipts = new Map<string, MoonReyIssuanceReceipt>();
  private readonly corrections: ProductiveCorrection[] = [];
  private readonly policies: MoonReyIssuancePolicy[];
  private readonly epochs = new Map<number, EpochIssuance>();
  private supply: NativeAssetSupplyState = emptyMoonReySupply();
  private metrics = emptyMetrics();
  private graph: ProductiveCapacityGraph;
  private clock: EngineClock;
  readonly units: UnitRegistry;

  constructor(
    clock: EngineClock,
    policies: readonly MoonReyIssuancePolicy[] = [developmentIssuancePolicy(1)],
    units: UnitRegistry = defaultUnitRegistry,
  ) {
    this.clock = clock;
    this.policies = [...policies];
    this.units = units;
    this.graph = buildProductiveCapacityGraph(this.sources());
  }

  activePolicy(): MoonReyIssuancePolicy {
    const policy = policyAtHeight(this.policies, this.clock.height);
    if (!policy) {
      throw new Error('no MoonRey issuance policy is active at this height');
    }
    return policy;
  }

  activatePolicy(policy: MoonReyIssuancePolicy): void {
    this.policies.push(policy);
  }

  setClock(clock: EngineClock): void {
    this.clock = clock;
  }

  registerObject(object: ProductiveEconomicObject): ProductiveEconomicObject {
    this.objects.set(object.objectId, object);
    this.metrics.productive_objects = this.objects.size;
    this.rebuildGraph();
    return object;
  }

  putRight(right: RightObject): void {
    this.rights.set(right.rightId, right);
  }

  putOracleFact(fact: OracleFact): void {
    this.facts.set(fact.factId, fact);
    this.refreshOracleConcentration();
    this.rebuildGraph();
  }

  submitClaim(claim: ProductiveClaim): ProductiveClaim {
    this.claims.set(claim.claimId, claim);
    this.metrics.productive_claims = this.claims.size;
    this.rebuildGraph();
    return claim;
  }

  verifyClaim(claimId: string):
    | { readonly ok: true; readonly contribution: VerifiedProductiveContribution }
    | { readonly ok: false; readonly code: ProductiveRejectionCode } {
    const claim = this.claims.get(claimId);
    if (!claim) {
      return { ok: false, code: 'UNREGISTERED_OBJECT' };
    }
    const result = verifyProductiveClaim(claim, {
      height: this.clock.height,
      blockTimeUnixSeconds: this.clock.blockTimeUnixSeconds,
      object: this.objects.get(claim.objectId),
      rights: [...this.rights.values()],
      facts: [...this.facts.values()],
      policy: this.activePolicy(),
      knownFingerprints: this.fingerprints,
      unitRegistry: this.units,
      canonicalMeasurement: claim.canonicalMeasurement,
      contributionSchema: claim.contributionSchema,
    });
    if (!result.ok) {
      this.metrics.rejected_contributions += 1;
      if (result.code === 'DUPLICATE_CONTRIBUTION') {
        this.metrics.duplicate_contributions += 1;
      }
      return result;
    }
    this.contributions.set(result.contribution.contributionId, result.contribution);
    this.fingerprints.add(result.contribution.fingerprint);
    this.metrics.verified_contributions = this.contributions.size;
    this.rebuildGraph();
    return result;
  }

  authorizeIssuance(contributionId: string):
    | { readonly ok: true; readonly authorization: MoonReyIssuanceAuthorization }
    | { readonly ok: false; readonly code: ProductiveRejectionCode } {
    const contribution = this.contributions.get(contributionId);
    if (!contribution) {
      return { ok: false, code: 'UNREGISTERED_OBJECT' };
    }
    const epoch = this.epochOf(contribution.measurementPeriod.epoch);
    const result = evaluateIssuance(contribution, this.activePolicy(), epoch, this.issuedFingerprints);
    if (!result.ok) {
      if (result.code === 'DUPLICATE_ISSUANCE') {
        this.metrics.duplicate_contributions += 1;
      }
      return result;
    }
    this.authorizations.set(result.authorization.authorizationId, result.authorization);
    return result;
  }

  finalizeIssuance(authorizationId: string):
    | { readonly ok: true; readonly receipt: MoonReyIssuanceReceipt; readonly supply: NativeAssetSupplyState }
    | { readonly ok: false; readonly code: ProductiveRejectionCode } {
    const authorization = this.authorizations.get(authorizationId);
    if (!authorization || authorization.finalized) {
      return { ok: false, code: 'AUTHORIZATION_NOT_FINALIZED' };
    }
    if (this.issuedFingerprints.has(authorization.fingerprint)) {
      return { ok: false, code: 'DUPLICATE_ISSUANCE' };
    }
    const contribution = this.contributions.get(authorization.contributionId);
    if (!contribution) {
      return { ok: false, code: 'UNREGISTERED_OBJECT' };
    }
    const receipt = finalizeIssuance(authorization, contribution, this.clock.height, this.clock.blockId);
    this.receipts.set(receipt.issuanceId, receipt);
    this.issuedFingerprints.add(authorization.fingerprint);
    this.authorizations.delete(authorizationId);
    this.supply = applyIssuance(this.supply, receipt.moonreyQuantity);
    const epoch = recordEpochIssuance(
      this.epochOf(contribution.measurementPeriod.epoch),
      contribution,
      receipt.moonreyQuantity,
    );
    this.epochs.set(epoch.epoch, epoch);
    this.contributions.set(contribution.contributionId, { ...contribution, status: 'ISSUED' });
    this.metrics.moonrey_issuance += 1;
    this.metrics.moonrey_issuance_by_category = incrementCategory(
      this.metrics.moonrey_issuance_by_category,
      receipt.category,
      receipt.moonreyQuantity,
    );
    this.metrics.epoch_issuance = epoch.total.toString();
    const policy = this.activePolicy();
    this.metrics.category_limit_utilization = Object.freeze({
      ...this.metrics.category_limit_utilization,
      [receipt.category]: categoryUtilization(
        epoch.byCategory[receipt.category] ?? 0n,
        policy.maximumIssuancePerCategoryPerEpoch,
      ),
    });
    this.rebuildGraph();
    return { ok: true, receipt, supply: this.supply };
  }

  issueFromClaim(claimId: string):
    | { readonly ok: true; readonly receipt: MoonReyIssuanceReceipt; readonly supply: NativeAssetSupplyState }
    | { readonly ok: false; readonly code: ProductiveRejectionCode } {
    const verified = this.verifyClaim(claimId);
    if (!verified.ok) {
      return verified;
    }
    const authorized = this.authorizeIssuance(verified.contribution.contributionId);
    if (!authorized.ok) {
      return authorized;
    }
    return this.finalizeIssuance(authorized.authorization.authorizationId);
  }

  recordCorrection(correction: ProductiveCorrection): void {
    this.corrections.push(correction);
  }

  rebuildGraph(): ProductiveCapacityGraph {
    this.graph = buildProductiveCapacityGraph(this.sources());
    this.metrics.productive_graph_lag = 0;
    return this.graph;
  }

  dropGraph(): void {
    this.graph = buildProductiveCapacityGraph({
      objects: [],
      claims: [],
      facts: [],
      contributions: [],
      receipts: [],
    });
    this.metrics.productive_graph_lag = 1;
  }

  snapshot(): ProductiveSnapshot {
    this.rebuildGraph();
    return Object.freeze({
      objects: this.listObjects(),
      claims: this.listClaims(),
      facts: this.listFacts(),
      rights: [...this.rights.values()].sort((left, right) => left.rightId.localeCompare(right.rightId)),
      contributions: this.listContributions(),
      receipts: this.listReceipts(),
      corrections: [...this.corrections],
      supply: this.supply,
      graphHash: this.graph.projectionHash,
    });
  }

  restoreFromSnapshot(snapshot: ProductiveSnapshot): void {
    this.objects.clear();
    this.claims.clear();
    this.facts.clear();
    this.rights.clear();
    this.contributions.clear();
    this.fingerprints.clear();
    this.issuedFingerprints.clear();
    this.receipts.clear();
    this.authorizations.clear();
    this.corrections.length = 0;
    this.epochs.clear();
    for (const object of snapshot.objects) {
      this.objects.set(object.objectId, object);
    }
    for (const claim of snapshot.claims) {
      this.claims.set(claim.claimId, claim);
    }
    for (const fact of snapshot.facts) {
      this.facts.set(fact.factId, fact);
    }
    for (const right of snapshot.rights) {
      this.rights.set(right.rightId, right);
    }
    for (const contribution of snapshot.contributions) {
      this.contributions.set(contribution.contributionId, contribution);
      this.fingerprints.add(contribution.fingerprint);
      if (contribution.status === 'ISSUED') {
        this.issuedFingerprints.add(contribution.fingerprint);
      }
    }
    for (const receipt of snapshot.receipts) {
      this.receipts.set(receipt.issuanceId, receipt);
    }
    this.corrections.push(...snapshot.corrections);
    this.supply = snapshot.supply;
    this.metrics.productive_objects = this.objects.size;
    this.metrics.productive_claims = this.claims.size;
    this.metrics.verified_contributions = this.contributions.size;
    this.metrics.moonrey_issuance = this.receipts.size;
    this.rebuildGraph();
  }

  object(objectId: string): ProductiveEconomicObject | undefined {
    return queryObject(this.listObjects(), objectId);
  }

  contribution(contributionId: string): VerifiedProductiveContribution | undefined {
    return this.contributions.get(contributionId);
  }

  receipt(issuanceId: string): MoonReyIssuanceReceipt | undefined {
    return this.receipts.get(issuanceId);
  }

  lineage(contributionId: string): LineageView | undefined {
    return contributionLineage(this.listContributions(), this.listReceipts(), contributionId);
  }

  attribution(): readonly AttributionView[] {
    return issuanceAttribution(this.listReceipts(), this.listContributions());
  }

  capacity(): readonly CategoryAggregate[] {
    return capacityByCategory(this.listClaims());
  }

  output(): readonly CategoryAggregate[] {
    return outputByCategory(this.listClaims());
  }

  geography(): readonly GeographyAggregate[] {
    return geographicAggregates(this.listContributions(), this.listReceipts());
  }

  epochsView(): readonly EpochAggregate[] {
    return epochAggregates(this.listReceipts());
  }

  currentGraph(): ProductiveCapacityGraph {
    return this.graph;
  }

  currentSupply(): NativeAssetSupplyState {
    return this.supply;
  }

  supplyIsReconciled(): boolean {
    const receiptTotal = this.listReceipts().reduce((sum, receipt) => sum + receipt.moonreyQuantity, 0n);
    return supplyReconciles(this.supply) && this.supply.issued === receiptTotal;
  }

  currentMetrics(): ProductiveMetrics {
    return { ...this.metrics };
  }

  listObjects(): readonly ProductiveEconomicObject[] {
    return [...this.objects.values()].sort((left, right) => left.objectId.localeCompare(right.objectId));
  }

  listClaims(): readonly ProductiveClaim[] {
    return [...this.claims.values()].sort((left, right) => left.claimId.localeCompare(right.claimId));
  }

  listFacts(): readonly OracleFact[] {
    return [...this.facts.values()].sort((left, right) => left.factId.localeCompare(right.factId));
  }

  listContributions(): readonly VerifiedProductiveContribution[] {
    return [...this.contributions.values()].sort((left, right) =>
      left.contributionId.localeCompare(right.contributionId),
    );
  }

  listReceipts(): readonly MoonReyIssuanceReceipt[] {
    return [...this.receipts.values()].sort((left, right) => left.issuanceId.localeCompare(right.issuanceId));
  }

  objectActive(objectId: string): boolean {
    const object = this.objects.get(objectId);
    return object ? objectIsActive(object, this.clock.height, this.clock.blockTimeUnixSeconds) : false;
  }

  private epochOf(epoch: number): EpochIssuance {
    return this.epochs.get(epoch) ?? emptyEpoch(epoch);
  }

  private sources() {
    return {
      objects: this.listObjects(),
      claims: this.listClaims(),
      facts: this.listFacts(),
      contributions: this.listContributions(),
      receipts: this.listReceipts(),
    };
  }

  private refreshOracleConcentration(): void {
    const counts: Record<string, number> = {};
    for (const fact of this.facts.values()) {
      counts[fact.sourceId] = (counts[fact.sourceId] ?? 0) + 1;
    }
    this.metrics.oracle_concentration = Object.freeze(counts);
  }
}

export function replicaFromSnapshot(snapshot: ProductiveSnapshot, clock: EngineClock): ProductiveEconomyEngine {
  const engine = new ProductiveEconomyEngine(clock);
  engine.restoreFromSnapshot(snapshot);
  return engine;
}
