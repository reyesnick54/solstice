import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { DomainEvent, DomainEventLog } from '../../events/src/events.ts';
import { Money } from '../../money/src/money.ts';
import { authorizeGraphDeclare, authorizeGraphRead, type GraphAccessFailure } from './access.ts';
import { deriveCashFlow, monthlyWindowContaining, type CurrencyCashFlow } from './cash-flow.ts';
import type { EconomicEdge } from './edge.ts';
import type { EconomicFact } from './fact.ts';
import type { EconomicGraph } from './graph.ts';
import {
  deterministicEdgeId,
  deterministicNodeId,
  deterministicOpportunityId,
  deterministicSnapshotId,
  deterministicSourceId,
  type EconomicGraphId,
  type EconomicNodeId,
} from './ids.ts';
import type { EconomicNode } from './node.ts';
import type { EconomicOpportunity } from './opportunity.ts';
import { freezeProvenance, type FactConfidence, type Provenance, type SourceType } from './provenance.ts';
import { EconomicGraphProjector, type ClassifiedActivityOverlay } from './projection.ts';
import { detectRecurringPatterns, incomeKindFromClassification } from './recurring.ts';
import {
  freezeSnapshot,
  type PersonalEconomicSnapshot,
  type SnapshotDebt,
  type SnapshotGoal,
  type SnapshotIncomeSummary,
  type SnapshotInvestment,
  type SnapshotObligation,
  type SnapshotOpportunity,
} from './snapshot.ts';
import { InMemoryEconomicGraphStore } from './store.ts';
import type {
  AssetKind,
  DebtKind,
  GoalKind,
  GoalStatus,
  LiabilityKind,
  OpportunityKind,
  SerializedMoney,
} from './taxonomy.ts';

export type EconomicGraphFailure = GraphAccessFailure | { readonly code: 'INVALID_FACT'; readonly message: string };

export type DeclaredAssetInput = {
  readonly assetKind: AssetKind;
  readonly label: string;
  readonly estimatedValue?: SerializedMoney;
};

export type DeclaredLiabilityInput = {
  readonly liabilityKind: LiabilityKind;
  readonly label: string;
  readonly estimatedBalance?: SerializedMoney;
};

export type DeclaredDebtInput = {
  readonly debtKind: DebtKind;
  readonly label: string;
  readonly estimatedBalance?: SerializedMoney;
};

export type DeclaredGoalInput = {
  readonly goalKind: GoalKind;
  readonly label: string;
  readonly target: SerializedMoney;
  readonly targetDate?: UtcInstant;
  readonly priority: number;
  readonly status?: GoalStatus;
};

export type DeclaredIncomeInput = {
  readonly incomeKind: 'SALARY' | 'FREELANCE' | 'BENEFITS' | 'INVESTMENT_INCOME' | 'BUSINESS_DISTRIBUTION' | 'OTHER';
  readonly label: string;
  readonly estimatedAmount?: SerializedMoney;
};

export type DeclaredDataAssetInput = {
  readonly label: string;
  readonly vaultAssetId: string;
  readonly contentHash?: string | null;
  readonly category?: string;
  readonly derivedFromVaultAssetId?: string;
};

export type GraphView = {
  readonly graph: EconomicGraph;
  readonly nodes: readonly EconomicNode[];
  readonly edges: readonly EconomicEdge[];
  readonly facts: readonly EconomicFact[];
};

export class EconomicGraphService {
  readonly store: InMemoryEconomicGraphStore;
  readonly projector: EconomicGraphProjector;
  private readonly clock: Clock;
  private readonly events: DomainEventLog | undefined;

  constructor(input: {
    readonly clock: Clock;
    readonly store?: InMemoryEconomicGraphStore;
    readonly events?: DomainEventLog;
  }) {
    this.clock = input.clock;
    this.store = input.store ?? new InMemoryEconomicGraphStore();
    this.events = input.events;
    this.projector = new EconomicGraphProjector({
      store: this.store,
      now: () => this.clock.now(),
      ...(input.events ? { events: input.events } : {}),
    });
  }

  registerOverlay(overlay: ClassifiedActivityOverlay): void {
    this.projector.registerOverlay(overlay);
  }

  registerAccountCurrency(accountId: string, currency: string): void {
    this.projector.registerAccountCurrency(accountId, currency);
  }

  ingest(event: DomainEvent, subjectHint?: string): void {
    this.projector.ingest(event, subjectHint);
  }

  ingestAll(events: readonly DomainEvent[], subjectHint?: string): void {
    this.projector.ingestAll(events, subjectHint);
  }

  openGraph(actor: unknown, subjectId: string, customerId?: string): Result<EconomicGraph, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, customerId, this.clock.now());
    const graph = this.store.getGraph(graphId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'graph was not created' });
    }
    return ok(graph);
  }

  getEconomicGraph(actor: unknown, subjectId: string): Result<GraphView, EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    return ok({
      graph,
      nodes: this.store.nodesFor(graph.graphId),
      edges: this.store.edgesFor(graph.graphId),
      facts: this.store.currentFactsFor(graph.graphId, this.clock.now()),
    });
  }

  getIncomeSources(actor: unknown, subjectId: string): Result<readonly EconomicNode[], EconomicGraphFailure> {
    return this.nodesOfKind(actor, subjectId, 'INCOME_SOURCE');
  }

  getRecurringExpenses(actor: unknown, subjectId: string): Result<readonly EconomicNode[], EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    return ok(
      this.store
        .nodesFor(graph.graphId)
        .filter((node) => node.kind === 'SUBSCRIPTION' || node.kind === 'EXPENSE' || node.kind === 'INSURANCE'),
    );
  }

  getDebts(actor: unknown, subjectId: string): Result<readonly EconomicNode[], EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    return ok(this.store.nodesFor(graph.graphId).filter((node) => node.kind === 'DEBT' || node.kind === 'LIABILITY'));
  }

  getGoals(actor: unknown, subjectId: string): Result<readonly EconomicNode[], EconomicGraphFailure> {
    return this.nodesOfKind(actor, subjectId, 'GOAL');
  }

  getOpportunities(actor: unknown, subjectId: string): Result<readonly EconomicOpportunity[], EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    return ok(this.store.opportunitiesFor(graph.graphId));
  }

  getNodeProvenance(actor: unknown, subjectId: string, nodeId: EconomicNodeId): Result<
    { readonly node: EconomicNode; readonly facts: readonly EconomicFact[] },
    EconomicGraphFailure
  > {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const node = this.store.getNode(nodeId);
    if (!node) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'node not found' });
    }
    return ok({ node, facts: this.store.factsForNode(nodeId, this.clock.now()) });
  }

  declareAsset(actor: unknown, subjectId: string, input: DeclaredAssetInput): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `${input.assetKind}_${input.label}`.toLowerCase().replace(/\s+/g, '_');
    const nodeId = deterministicNodeId('ASSET', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'ASSET',
      attributes: {
        kind: 'ASSET',
        assetKind: input.assetKind,
        holdingKind: 'USER_DECLARED',
        label: input.label,
        ...(input.estimatedValue ? { estimatedValue: input.estimatedValue } : {}),
      },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'OWNS', at);
    this.projector.emitPublic('EconomicGraphNodeCreated', graphId, at, { nodeId, kind: 'ASSET' });
    return ok(node);
  }

  declareDataAsset(
    actor: unknown,
    subjectId: string,
    input: DeclaredDataAssetInput,
  ): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `vault_${input.vaultAssetId}`.toLowerCase();
    const nodeId = deterministicNodeId('DATA_ASSET', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'DATA_ASSET',
      attributes: {
        kind: 'DATA_ASSET',
        label: input.label,
        vaultAssetId: input.vaultAssetId,
        ...(input.contentHash ? { contentHash: input.contentHash } : {}),
        ...(input.category ? { category: input.category } : {}),
      },
      canonicalRef: { system: 'PERSONAL_DATA_VAULT', id: input.vaultAssetId },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'OWNS', at);
    if (input.derivedFromVaultAssetId) {
      const sourceNodeId = deterministicNodeId('DATA_ASSET', `vault_${input.derivedFromVaultAssetId}`.toLowerCase());
      if (this.store.getNode(sourceNodeId)) {
        this.store.putEdge({
          edgeId: deterministicEdgeId('DERIVED_FROM', nodeId, sourceNodeId),
          graphId,
          kind: 'DERIVED_FROM',
          fromNodeId: nodeId,
          toNodeId: sourceNodeId,
          validFrom: at,
          validTo: null,
          quality: 'CURRENT',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(input.vaultAssetId, at),
          createdAt: at,
          survivesRebuild: true,
        });
        this.projector.emitPublic('EconomicGraphRelationshipCreated', graphId, at, {
          fromNodeId: nodeId,
          toNodeId: sourceNodeId,
          kind: 'DERIVED_FROM',
        });
      }
    }
    this.projector.emitPublic('EconomicGraphNodeCreated', graphId, at, { nodeId, kind: 'DATA_ASSET' });
    return ok(node);
  }

  declareLiability(
    actor: unknown,
    subjectId: string,
    input: DeclaredLiabilityInput,
  ): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `${input.liabilityKind}_${input.label}`.toLowerCase().replace(/\s+/g, '_');
    const nodeId = deterministicNodeId('LIABILITY', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'LIABILITY',
      attributes: {
        kind: 'LIABILITY',
        liabilityKind: input.liabilityKind,
        holdingKind: 'USER_DECLARED',
        label: input.label,
        ...(input.estimatedBalance ? { estimatedBalance: input.estimatedBalance } : {}),
      },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'OWES', at);
    this.projector.emitPublic('EconomicGraphNodeCreated', graphId, at, { nodeId, kind: 'LIABILITY' });
    return ok(node);
  }

  declareDebt(actor: unknown, subjectId: string, input: DeclaredDebtInput): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `${input.debtKind}_${input.label}`.toLowerCase().replace(/\s+/g, '_');
    const nodeId = deterministicNodeId('DEBT', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'DEBT',
      attributes: {
        kind: 'DEBT',
        debtKind: input.debtKind,
        holdingKind: 'USER_DECLARED',
        label: input.label,
        ...(input.estimatedBalance ? { estimatedBalance: input.estimatedBalance } : {}),
      },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'OWES', at);
    this.projector.emitPublic('EconomicGraphNodeCreated', graphId, at, { nodeId, kind: 'DEBT' });
    return ok(node);
  }

  declareGoal(actor: unknown, subjectId: string, input: DeclaredGoalInput): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const money = this.parseMoney(input.target);
    if (!money.ok) {
      return money;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `${input.goalKind}_${input.label}`.toLowerCase().replace(/\s+/g, '_');
    const nodeId = deterministicNodeId('GOAL', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'GOAL',
      attributes: {
        kind: 'GOAL',
        goalKind: input.goalKind,
        label: input.label,
        target: input.target,
        targetDate: input.targetDate ?? null,
        priority: input.priority,
        status: input.status ?? 'ACTIVE',
      },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'SUPPORTS_GOAL', at);
    this.projector.emitPublic('EconomicGraphNodeCreated', graphId, at, { nodeId, kind: 'GOAL' });
    return ok(node);
  }

  declareIncomeSource(
    actor: unknown,
    subjectId: string,
    input: DeclaredIncomeInput,
  ): Result<EconomicNode, EconomicGraphFailure> {
    const allowed = authorizeGraphDeclare(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graphId = this.projector.ensureGraph(subjectId, undefined, this.clock.now());
    const key = `${input.incomeKind}_${input.label}`.toLowerCase().replace(/\s+/g, '_');
    const nodeId = deterministicNodeId('INCOME_SOURCE', key);
    const at = this.clock.now();
    const node = this.store.putNode({
      nodeId,
      graphId,
      kind: 'INCOME_SOURCE',
      attributes: {
        kind: 'INCOME_SOURCE',
        incomeKind: input.incomeKind,
        label: input.label,
        ...(input.estimatedAmount ? { estimatedAmount: input.estimatedAmount } : {}),
      },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: this.userProvenance(subjectId, at),
      createdAt: at,
      survivesRebuild: true,
    });
    this.linkPerson(graphId, subjectId, nodeId, 'RECEIVES_FROM', at);
    return ok(node);
  }

  materializeRecurring(subjectId: string): readonly EconomicNode[] {
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return Object.freeze([]);
    }
    const patterns = detectRecurringPatterns(this.store.activitiesFor(graph.graphId));
    const created: EconomicNode[] = [];
    const at = this.clock.now();
    const personId = deterministicNodeId('PERSON', subjectId);
    for (const pattern of patterns) {
      if (pattern.direction === 'INFLOW') {
        const nodeId = deterministicNodeId(
          'INCOME_SOURCE',
          `${pattern.counterpartRef}_${pattern.amount.currency}_${pattern.amount.minorUnits}`,
        );
        const node = this.store.putNode({
          nodeId,
          graphId: graph.graphId,
          kind: 'INCOME_SOURCE',
          attributes: {
            kind: 'INCOME_SOURCE',
            incomeKind: incomeKindFromClassification(pattern.classification),
            label: pattern.counterpartLabel ?? pattern.counterpartRef,
            estimatedAmount: pattern.amount,
            cadence: pattern.cadence,
          },
          quality: 'CURRENT',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
          createdAt: at,
          survivesRebuild: false,
        });
        this.linkPerson(graph.graphId, subjectId, nodeId, 'RECEIVES_FROM', at, 'DERIVED');
        this.linkPerson(graph.graphId, subjectId, nodeId, 'GENERATES_INCOME', at, 'DERIVED');
        created.push(node);
        continue;
      }
      if (pattern.classification === 'SUBSCRIPTION') {
        const nodeId = deterministicNodeId(
          'SUBSCRIPTION',
          `${pattern.counterpartRef}_${pattern.amount.currency}_${pattern.amount.minorUnits}`,
        );
        const merchantId = deterministicNodeId('MERCHANT', `${pattern.counterpartKind}_${pattern.counterpartRef}`);
        const node = this.store.putNode({
          nodeId,
          graphId: graph.graphId,
          kind: 'SUBSCRIPTION',
          attributes: {
            kind: 'SUBSCRIPTION',
            merchantRef: pattern.counterpartRef,
            estimatedAmount: pattern.amount,
            cadence: pattern.cadence,
            lastObserved: pattern.lastObserved,
            nextExpected: pattern.nextExpected,
            cancellationCapability: 'NOT_IMPLEMENTED',
          },
          quality: 'CURRENT',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
          createdAt: at,
          survivesRebuild: false,
        });
        this.store.putEdge({
          edgeId: deterministicEdgeId('SUBSCRIBES_TO', personId, merchantId),
          graphId: graph.graphId,
          kind: 'SUBSCRIBES_TO',
          fromNodeId: personId,
          toNodeId: merchantId,
          validFrom: at,
          validTo: null,
          quality: 'CURRENT',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
          createdAt: at,
          survivesRebuild: false,
        });
        this.store.putEdge({
          edgeId: deterministicEdgeId('INCURS_COST', personId, nodeId),
          graphId: graph.graphId,
          kind: 'INCURS_COST',
          fromNodeId: personId,
          toNodeId: nodeId,
          validFrom: at,
          validTo: null,
          quality: 'CURRENT',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
          createdAt: at,
          survivesRebuild: false,
        });
        created.push(node);
        continue;
      }
      if (pattern.classification === 'LOAN_PAYMENT') {
        const nodeId = deterministicNodeId(
          'DEBT',
          `${pattern.counterpartRef}_${pattern.amount.currency}_${pattern.amount.minorUnits}`,
        );
        const node = this.store.putNode({
          nodeId,
          graphId: graph.graphId,
          kind: 'DEBT',
          attributes: {
            kind: 'DEBT',
            debtKind: 'LOAN',
            holdingKind: 'SOLSTICE_HOLDING',
            label: pattern.counterpartLabel ?? pattern.counterpartRef,
            estimatedBalance: pattern.amount,
          },
          quality: 'INCOMPLETE',
          confidence: 'DERIVED',
          provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
          createdAt: at,
          survivesRebuild: false,
        });
        this.linkPerson(graph.graphId, subjectId, nodeId, 'OWES', at, 'DERIVED');
        created.push(node);
        continue;
      }
      const nodeId = deterministicNodeId(
        'EXPENSE',
        `${pattern.classification}_${pattern.counterpartRef}_${pattern.amount.minorUnits}`,
      );
      const node = this.store.putNode({
        nodeId,
        graphId: graph.graphId,
        kind: 'EXPENSE',
        attributes: {
          kind: 'EXPENSE',
          expenseKind: pattern.classification === 'RENT' ? 'RENT' : 'OTHER',
          label: pattern.counterpartLabel ?? pattern.counterpartRef,
          estimatedAmount: pattern.amount,
        },
        quality: 'CURRENT',
        confidence: 'DERIVED',
        provenance: this.derivedProvenance(pattern.sourceRefs.join(','), at),
        createdAt: at,
        survivesRebuild: false,
      });
      this.linkPerson(graph.graphId, subjectId, nodeId, 'PAYS_TO', at, 'DERIVED');
      this.linkPerson(graph.graphId, subjectId, nodeId, 'INCURS_COST', at, 'DERIVED');
      created.push(node);
    }
    return Object.freeze(created);
  }

  proposeOpportunities(subjectId: string): readonly EconomicOpportunity[] {
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return Object.freeze([]);
    }
    const at = this.clock.now();
    const created: EconomicOpportunity[] = [];
    const subscriptions = this.store.nodesFor(graph.graphId).filter((node) => node.kind === 'SUBSCRIPTION');
    for (const subscription of subscriptions) {
      created.push(this.putOpportunity(graph.graphId, 'CANCEL_UNUSED_SUBSCRIPTION', subscription.nodeId, at, {
        title: 'Review recurring subscription',
        related: [subscription.nodeId],
      }));
    }
    const savings = this.store
      .nodesFor(graph.graphId)
      .filter((node) => node.kind === 'ACCOUNT' && node.attributes.kind === 'ACCOUNT' && node.attributes.accountClass === 'SAVINGS_DEPOSIT');
    if (savings[0]) {
      created.push(this.putOpportunity(graph.graphId, 'MOVE_IDLE_CASH', savings[0].nodeId, at, {
        title: 'Review idle cash against emergency reserve',
        related: [savings[0].nodeId],
      }));
    }
    const debts = this.store.nodesFor(graph.graphId).filter((node) => node.kind === 'DEBT' || node.kind === 'LIABILITY');
    if (debts[0]) {
      created.push(this.putOpportunity(graph.graphId, 'REFINANCE_DEBT', debts[0].nodeId, at, {
        title: 'Refinance proposal (not executable)',
        related: [debts[0].nodeId],
      }));
    }
    return Object.freeze(created);
  }

  getEconomicSnapshot(actor: unknown, subjectId: string): Result<PersonalEconomicSnapshot, EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    const at = this.clock.now();
    const window = monthlyWindowContaining(at);
    const cashFlow = deriveCashFlow(this.store.activitiesFor(graph.graphId), window);
    const nodes = this.store.nodesFor(graph.graphId);
    const liquidAssetsByCurrency = this.liquidAssets(graph.graphId, nodes, at);
    const income: SnapshotIncomeSummary[] = nodes
      .filter((node) => node.kind === 'INCOME_SOURCE' && node.attributes.kind === 'INCOME_SOURCE')
      .map((node) => {
        const attrs = node.attributes;
        if (attrs.kind !== 'INCOME_SOURCE') {
          throw new Error('income node mismatch');
        }
        return {
          nodeId: node.nodeId,
          label: attrs.label,
          incomeKind: attrs.incomeKind,
          ...(attrs.estimatedAmount ? { estimatedAmount: attrs.estimatedAmount } : {}),
          ...(attrs.cadence ? { cadence: attrs.cadence } : {}),
          confidence: node.confidence,
          sourceRefs: Object.freeze([node.provenance.sourceRef]),
        };
      });
    const knownRecurringObligations: SnapshotObligation[] = nodes
      .filter((node) => node.kind === 'SUBSCRIPTION' || node.kind === 'EXPENSE')
      .map((node) => {
        if (node.attributes.kind === 'SUBSCRIPTION') {
          return {
            nodeId: node.nodeId,
            kind: 'SUBSCRIPTION',
            label: node.attributes.merchantRef,
            estimatedAmount: node.attributes.estimatedAmount,
            cadence: node.attributes.cadence,
            confidence: node.confidence,
            sourceRefs: Object.freeze([node.provenance.sourceRef]),
          };
        }
        if (node.attributes.kind === 'EXPENSE') {
          return {
            nodeId: node.nodeId,
            kind: 'EXPENSE',
            label: node.attributes.label,
            estimatedAmount: node.attributes.estimatedAmount ?? { minorUnits: '0', currency: 'USD' },
            confidence: node.confidence,
            sourceRefs: Object.freeze([node.provenance.sourceRef]),
          };
        }
        return {
          nodeId: node.nodeId,
          kind: node.kind,
          label: node.kind,
          estimatedAmount: { minorUnits: '0', currency: 'USD' },
          confidence: node.confidence,
          sourceRefs: Object.freeze([node.provenance.sourceRef]),
        };
      });
    const debt: SnapshotDebt[] = nodes
      .filter((node) => node.kind === 'DEBT' || node.kind === 'LIABILITY')
      .map((node) => {
        if (node.attributes.kind === 'DEBT') {
          return {
            nodeId: node.nodeId,
            label: node.attributes.label,
            holdingKind: node.attributes.holdingKind,
            ...(node.attributes.estimatedBalance ? { estimatedBalance: node.attributes.estimatedBalance } : {}),
            confidence: node.confidence,
          };
        }
        if (node.attributes.kind === 'LIABILITY') {
          return {
            nodeId: node.nodeId,
            label: node.attributes.label,
            holdingKind: node.attributes.holdingKind,
            ...(node.attributes.estimatedBalance ? { estimatedBalance: node.attributes.estimatedBalance } : {}),
            confidence: node.confidence,
          };
        }
        return {
          nodeId: node.nodeId,
          label: node.kind,
          holdingKind: 'USER_DECLARED',
          confidence: node.confidence,
        };
      });
    const investments: SnapshotInvestment[] = nodes
      .filter((node) => node.kind === 'INVESTMENT')
      .map((node) => ({
        nodeId: node.nodeId,
        label: node.attributes.kind === 'INVESTMENT' ? node.attributes.label : node.kind,
        holdingKind: node.attributes.kind === 'INVESTMENT' ? node.attributes.holdingKind : 'USER_DECLARED',
        confidence: node.confidence,
      }));
    const goals: SnapshotGoal[] = nodes
      .filter((node) => node.kind === 'GOAL' && node.attributes.kind === 'GOAL')
      .map((node) => {
        const attrs = node.attributes;
        if (attrs.kind !== 'GOAL') {
          throw new Error('goal node mismatch');
        }
        return {
          nodeId: node.nodeId,
          goalKind: attrs.goalKind,
          label: attrs.label,
          target: attrs.target,
          targetDate: attrs.targetDate,
          priority: attrs.priority,
          status: attrs.status,
        };
      });
    const economicOpportunities: SnapshotOpportunity[] = this.store.opportunitiesFor(graph.graphId).map((item) => ({
      opportunityId: item.opportunityId,
      kind: item.kind,
      title: item.title,
      executable: false,
      status: 'PROPOSAL',
    }));
    const snapshot = freezeSnapshot({
      snapshotId: deterministicSnapshotId(graph.graphId, at),
      graphId: graph.graphId,
      subjectId,
      generatedAt: at,
      liquidAssetsByCurrency,
      income,
      knownRecurringObligations,
      debt,
      investments,
      monthlyCashFlow: cashFlow,
      goals,
      economicOpportunities,
      valuationContext: null,
      crossCurrencyTotal: null,
      authoritativeBalance: false,
      ledgerWins: true,
    });
    this.store.putSnapshot({
      snapshotId: snapshot.snapshotId,
      graphId: graph.graphId,
      generatedAt: at,
      bodyCanonical: JSON.stringify(snapshot),
    });
    this.projector.emitPublic('EconomicGraphSnapshotCreated', graph.graphId, at, {
      snapshotId: snapshot.snapshotId,
    });
    return ok(snapshot);
  }

  rebuildDerivedProjection(subjectId: string, events: readonly DomainEvent[]): Result<GraphView, EconomicGraphFailure> {
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    this.store.destroyDerived(graph.graphId);
    this.projector.ensureGraph(subjectId, graph.customerId, this.clock.now());
    this.projector.ingestAll(events, subjectId);
    this.materializeRecurring(subjectId);
    this.proposeOpportunities(subjectId);
    return ok({
      graph: this.store.getGraph(graph.graphId) ?? graph,
      nodes: this.store.nodesFor(graph.graphId),
      edges: this.store.edgesFor(graph.graphId),
      facts: this.store.currentFactsFor(graph.graphId, this.clock.now()),
    });
  }

  cashFlowFor(subjectId: string, from: UtcInstant, to: UtcInstant): readonly CurrencyCashFlow[] {
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return Object.freeze([]);
    }
    return deriveCashFlow(this.store.activitiesFor(graph.graphId), { from, to });
  }

  private nodesOfKind(
    actor: unknown,
    subjectId: string,
    kind: EconomicNode['kind'],
  ): Result<readonly EconomicNode[], EconomicGraphFailure> {
    const allowed = authorizeGraphRead(actor, subjectId);
    if (!allowed.ok) {
      return allowed;
    }
    const graph = this.store.getGraphBySubject(subjectId);
    if (!graph) {
      return err({ code: 'GRAPH_NOT_FOUND', message: 'no economic graph for subject' });
    }
    return ok(this.store.nodesFor(graph.graphId).filter((node) => node.kind === kind));
  }

  private linkPerson(
    graphId: EconomicGraphId,
    subjectId: string,
    to: EconomicNodeId,
    kind: 'OWNS' | 'OWES' | 'RECEIVES_FROM' | 'PAYS_TO' | 'SUPPORTS_GOAL' | 'GENERATES_INCOME' | 'INCURS_COST',
    at: UtcInstant,
    sourceType: SourceType = 'USER_DECLARED',
  ): void {
    const from = deterministicNodeId('PERSON', subjectId);
    const confidence: FactConfidence = sourceType === 'USER_DECLARED' ? 'USER_DECLARED' : 'DERIVED';
    this.store.putEdge({
      edgeId: deterministicEdgeId(kind, from, to),
      graphId,
      kind,
      fromNodeId: from,
      toNodeId: to,
      validFrom: at,
      validTo: null,
      quality: 'CURRENT',
      confidence,
      provenance: sourceType === 'USER_DECLARED' ? this.userProvenance(subjectId, at) : this.derivedProvenance(to, at),
      createdAt: at,
      survivesRebuild: sourceType === 'USER_DECLARED',
    });
  }

  private putOpportunity(
    graphId: EconomicGraphId,
    kind: OpportunityKind,
    anchor: EconomicNodeId,
    at: UtcInstant,
    input: { readonly title: string; readonly related: readonly EconomicNodeId[] },
  ): EconomicOpportunity {
    const opportunityId = deterministicOpportunityId(kind, anchor);
    const nodeId = deterministicNodeId('ECONOMIC_OPPORTUNITY', `${kind}_${anchor}`);
    this.store.putNode({
      nodeId,
      graphId,
      kind: 'ECONOMIC_OPPORTUNITY',
      attributes: { kind: 'ECONOMIC_OPPORTUNITY', opportunityKind: kind, executable: false },
      quality: 'CURRENT',
      confidence: 'DERIVED',
      provenance: this.derivedProvenance(opportunityId, at),
      createdAt: at,
      survivesRebuild: false,
    });
    const opportunity = this.store.putOpportunity({
      opportunityId,
      graphId,
      nodeId,
      kind,
      title: input.title,
      relatedNodeIds: input.related,
      status: 'PROPOSAL',
      executable: false,
      confidence: 'DERIVED',
      provenance: this.derivedProvenance(opportunityId, at),
      createdAt: at,
      survivesRebuild: false,
    });
    this.projector.emitPublic('EconomicGraphOpportunityCreated', graphId, at, {
      opportunityId,
      kind,
      executable: false,
    });
    return opportunity;
  }

  private liquidAssets(
    graphId: EconomicGraphId,
    nodes: readonly EconomicNode[],
    at: UtcInstant,
  ): PersonalEconomicSnapshot['liquidAssetsByCurrency'] {
    const byCurrency = new Map<string, { minor: bigint; refs: string[] }>();
    for (const node of nodes) {
      if (node.kind !== 'ACCOUNT') {
        continue;
      }
      const position = this.store.factsForNode(node.nodeId, at).find((fact) => fact.key === 'derived_position');
      if (!position || position.value.type !== 'MONEY') {
        continue;
      }
      const current = byCurrency.get(position.value.currency) ?? { minor: 0n, refs: [] };
      current.minor += BigInt(position.value.minorUnits);
      current.refs.push(position.provenance.sourceRef);
      byCurrency.set(position.value.currency, current);
    }
    if (byCurrency.size === 0) {
      const activities = this.store.activitiesFor(graphId);
      for (const activity of activities) {
        const current = byCurrency.get(activity.amount.currency) ?? { minor: 0n, refs: [] };
        const amount = BigInt(activity.amount.minorUnits);
        current.minor += activity.direction === 'INFLOW' ? amount : -amount;
        current.refs.push(activity.sourceRef);
        byCurrency.set(activity.amount.currency, current);
      }
    }
    return Object.freeze(
      [...byCurrency.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, value]) =>
          Object.freeze({
            amount: { minorUnits: value.minor.toString(), currency },
            sourceRefs: Object.freeze(value.refs),
            confidence: 'DERIVED' as const,
          }),
        ),
    );
  }

  private userProvenance(subjectId: string, at: UtcInstant): Provenance {
    return freezeProvenance({
      sourceId: deterministicSourceId('USER_DECLARED', subjectId),
      sourceType: 'USER_DECLARED',
      sourceRef: subjectId,
      observedAt: at,
      effectiveAt: at,
      confidence: 'USER_DECLARED',
      version: 1,
    });
  }

  private derivedProvenance(sourceRef: string, at: UtcInstant): Provenance {
    return freezeProvenance({
      sourceId: deterministicSourceId('DERIVED', sourceRef),
      sourceType: 'DERIVED',
      sourceRef,
      observedAt: at,
      effectiveAt: at,
      confidence: 'DERIVED',
      version: 1,
    });
  }

  private parseMoney(value: SerializedMoney): Result<Money, EconomicGraphFailure> {
    try {
      return ok(Money.fromMinorUnitsString(value.minorUnits, value.currency));
    } catch (error) {
      return err({
        code: 'INVALID_FACT',
        message: error instanceof Error ? error.message : 'invalid money',
      });
    }
  }
}
