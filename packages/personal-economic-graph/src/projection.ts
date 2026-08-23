import type { UtcInstant } from '../../domain/src/time.ts';
import type { DomainEvent, DomainEventLog } from '../../events/src/events.ts';
import {
  asEconomicSourceId,
  deterministicActivityId,
  deterministicEdgeId,
  deterministicFactId,
  deterministicNodeId,
  deterministicSourceId,
  graphIdForSubject,
  type EconomicGraphId,
  type EconomicNodeId,
} from './ids.ts';
import type { EconomicEdge } from './edge.ts';
import type { EconomicFact } from './fact.ts';
import { freezeGraph } from './graph.ts';
import type { EconomicNode, EconomicNodeAttributes } from './node.ts';
import {
  freezeProvenance,
  type FactConfidence,
  type Provenance,
  type SourceType,
} from './provenance.ts';
import type { ClassifiedActivityOverlay, InMemoryEconomicGraphStore } from './store.ts';
import type {
  ActivityClassification,
  CanonicalRef,
  Counterpart,
  EconomicEdgeKind,
  SerializedMoney,
} from './taxonomy.ts';

export type { ClassifiedActivityOverlay };

export type ProjectionPorts = {
  readonly store: InMemoryEconomicGraphStore;
  readonly events?: DomainEventLog;
  readonly now: () => UtcInstant;
};

function provenance(
  sourceType: SourceType,
  sourceRef: string,
  at: UtcInstant,
  confidence: FactConfidence,
): Provenance {
  return freezeProvenance({
    sourceId: deterministicSourceId(sourceType, sourceRef),
    sourceType,
    sourceRef,
    observedAt: at,
    effectiveAt: at,
    confidence,
    version: 1,
  });
}

function eventIdOf(event: DomainEvent): string {
  return event.eventId ?? `${event.eventType}:${event.occurredAt}:${JSON.stringify(event.payload)}`;
}

function payloadOf(event: DomainEvent): Record<string, unknown> {
  return event.payload as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export class EconomicGraphProjector {
  private readonly store: InMemoryEconomicGraphStore;
  private readonly events: DomainEventLog | undefined;
  private readonly now: () => UtcInstant;
  private readonly overlays = new Map<string, ClassifiedActivityOverlay>();
  private readonly accountCurrencies = new Map<string, string>();

  constructor(ports: ProjectionPorts) {
    this.store = ports.store;
    this.events = ports.events;
    this.now = ports.now;
  }

  registerOverlay(overlay: ClassifiedActivityOverlay): void {
    this.overlays.set(overlay.sourceEventId, overlay);
    this.store.putOverlay(overlay);
  }

  registerAccountCurrency(accountId: string, currency: string): void {
    this.accountCurrencies.set(accountId, currency);
    this.store.putAccountCurrency(accountId, currency);
  }

  hydrateOverlays(): void {
    for (const overlay of this.store.overlaysFor()) {
      this.overlays.set(overlay.sourceEventId, overlay);
    }
    for (const row of this.store.exportState().accountCurrencies) {
      this.accountCurrencies.set(row.accountId, row.currency);
    }
  }

  ingest(event: DomainEvent, subjectHint?: string): void {
    const eventId = eventIdOf(event);
    if (this.store.hasProcessed(eventId)) {
      return;
    }
    this.project(event, subjectHint);
    this.store.markProcessed(eventId);
  }

  ingestAll(events: readonly DomainEvent[], subjectHint?: string): void {
    for (const event of events) {
      this.ingest(event, subjectHint);
    }
  }

  ensureGraph(subjectId: string, customerId: string | undefined, at: UtcInstant): EconomicGraphId {
    const existing = this.store.getGraphBySubject(subjectId);
    const graphId = existing?.graphId ?? graphIdForSubject(subjectId);
    if (!existing) {
      this.store.putGraph(
        freezeGraph({
          graphId,
          subjectId,
          ...(customerId ? { customerId } : {}),
          createdAt: at,
          authoritativeBalance: false,
          mutatesFinancialState: false,
        }),
      );
    }
    const personId = deterministicNodeId('PERSON', subjectId);
    this.upsertNode({
      nodeId: personId,
      graphId,
      kind: 'PERSON',
      attributes: { kind: 'PERSON', subjectId, ...(customerId ? { customerId } : {}) },
      quality: 'CURRENT',
      confidence: 'VERIFIED',
      provenance: provenance('IDENTITY', subjectId, at, 'VERIFIED'),
      createdAt: at,
      survivesRebuild: false,
    });
    return graphId;
  }

  private project(event: DomainEvent, subjectHint?: string): void {
    const overlay = this.overlays.get(eventIdOf(event));
    const subjectId = overlay?.subjectId ?? subjectHint;
    switch (event.eventType) {
      case 'IdentityCreated':
      case 'IdentityActivated': {
        const identityId = str(payloadOf(event).identityId);
        if (identityId) {
          this.ensureGraph(identityId, undefined, event.occurredAt);
        }
        return;
      }
      case 'AccountOpened': {
        const ownerId = str(payloadOf(event).ownerId);
        const accountId = str(payloadOf(event).accountId);
        const accountClass = str(payloadOf(event).accountClass);
        if (!ownerId || !accountId) {
          return;
        }
        const subject = subjectId ?? ownerId;
        const graphId = this.ensureGraph(subject, ownerId, event.occurredAt);
        const personId = deterministicNodeId('PERSON', subject);
        const nodeId = deterministicNodeId('ACCOUNT', accountId);
        const currency = this.accountCurrencies.get(accountId) ?? 'USD';
        this.upsertNode({
          nodeId,
          graphId,
          kind: 'ACCOUNT',
          attributes: {
            kind: 'ACCOUNT',
            canonicalRef: { system: 'ACCOUNT', id: accountId },
            currency,
            ...(accountClass ? { accountClass } : {}),
          },
          canonicalRef: { system: 'ACCOUNT', id: accountId },
          quality: 'CURRENT',
          confidence: 'VERIFIED',
          provenance: provenance('CANONICAL_LEDGER', accountId, event.occurredAt, 'VERIFIED'),
          createdAt: event.occurredAt,
          survivesRebuild: false,
        });
        this.upsertEdge(graphId, 'OWNS', personId, nodeId, event.occurredAt, 'CANONICAL_LEDGER', accountId, 'VERIFIED');
        this.emit('EconomicGraphNodeCreated', graphId, event.occurredAt, { nodeId, kind: 'ACCOUNT' });
        this.emit('EconomicGraphRelationshipCreated', graphId, event.occurredAt, {
          kind: 'OWNS',
          from: personId,
          to: nodeId,
        });
        return;
      }
      case 'DepositPosted':
      case 'InterestPosted': {
        this.projectMovement(event, 'INFLOW', event.eventType === 'InterestPosted' ? 'INTEREST' : 'UNKNOWN', subjectId);
        return;
      }
      case 'WithdrawalPosted':
      case 'FeePosted': {
        this.projectMovement(event, 'OUTFLOW', event.eventType === 'FeePosted' ? 'FEE' : 'UNKNOWN', subjectId);
        return;
      }
      case 'InternalTransferPosted': {
        this.projectTransfer(event, subjectId);
        return;
      }
      case 'AccountPositionChanged': {
        this.projectPosition(event, subjectId);
        return;
      }
      case 'InvestmentAccountOpened': {
        this.projectInvestmentAccount(event, subjectId);
        return;
      }
      case 'InvestmentPositionChanged': {
        this.projectInvestmentHolding(event, subjectId);
        return;
      }
      case 'BeneficiaryCreated': {
        const ownerId = str(payloadOf(event).ownerId);
        const beneficiaryId = str(payloadOf(event).beneficiaryId);
        if (!ownerId || !beneficiaryId) {
          return;
        }
        const subject = subjectId ?? ownerId;
        const graphId = this.ensureGraph(subject, ownerId, event.occurredAt);
        const nodeId = deterministicNodeId('MERCHANT', `beneficiary_${beneficiaryId}`);
        this.upsertNode({
          nodeId,
          graphId,
          kind: 'MERCHANT',
          attributes: { kind: 'MERCHANT', merchantRef: beneficiaryId },
          canonicalRef: { system: 'BENEFICIARY', id: beneficiaryId },
          quality: 'CURRENT',
          confidence: 'VERIFIED',
          provenance: provenance('SOLSTICE_PAYMENT', beneficiaryId, event.occurredAt, 'VERIFIED'),
          createdAt: event.occurredAt,
          survivesRebuild: false,
        });
        return;
      }
      case 'PaymentInitiated':
      case 'PaymentSettled': {
        this.projectPayment(event, subjectId);
        return;
      }
      case 'CardTransactionSettled':
      case 'CardAuthorizationApproved': {
        this.projectCard(event, subjectId);
        return;
      }
      default:
        return;
    }
  }

  private projectMovement(
    event: DomainEvent,
    direction: 'INFLOW' | 'OUTFLOW',
    fallback: ActivityClassification,
    subjectHint?: string,
  ): void {
    const body = payloadOf(event);
    const accountId = str(body.accountId);
    const journalId = str(body.journalId) ?? eventIdOf(event);
    const amount = this.amountFrom(body);
    if (!accountId || !amount) {
      return;
    }
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint;
    if (!subject) {
      return;
    }
    const graphId = this.ensureGraph(subject, undefined, event.occurredAt);
    this.ensureAccountNode(graphId, accountId, amount.currency, event.occurredAt);
    const classification = overlay?.classification ?? fallback;
    const counterpart = overlay?.counterpart;
    this.store.putActivity({
      activityId: deterministicActivityId(journalId),
      graphId,
      subjectId: subject,
      accountId,
      direction: overlay?.direction ?? direction,
      amount: overlay?.amount ?? amount,
      occurredAt: overlay?.occurredAt ?? event.occurredAt,
      ...(counterpart ? { counterpart } : {}),
      classification,
      sourceType: 'CANONICAL_LEDGER',
      sourceRef: journalId,
      sourceEventType: event.eventType,
      sourceEventId: eventIdOf(event),
    });
    if (counterpart) {
      this.linkCounterpart(graphId, subject, accountId, counterpart, direction, event.occurredAt, journalId);
    }
  }

  private projectTransfer(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const source = str(body.sourceAccountId);
    const dest = str(body.destinationAccountId);
    const journalId = str(body.journalId) ?? eventIdOf(event);
    const amount = this.amountFrom(body);
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint;
    if (!source || !dest || !amount || !subject) {
      return;
    }
    const graphId = this.ensureGraph(subject, undefined, event.occurredAt);
    this.ensureAccountNode(graphId, source, amount.currency, event.occurredAt);
    this.ensureAccountNode(graphId, dest, amount.currency, event.occurredAt);
    this.store.putActivity({
      activityId: deterministicActivityId(`${journalId}_out`),
      graphId,
      subjectId: subject,
      accountId: source,
      direction: 'OUTFLOW',
      amount,
      occurredAt: event.occurredAt,
      counterpart: { kind: 'ACCOUNT', ref: dest },
      classification: 'TRANSFER',
      sourceType: 'CANONICAL_LEDGER',
      sourceRef: journalId,
      sourceEventType: event.eventType,
      sourceEventId: eventIdOf(event),
    });
    this.store.putActivity({
      activityId: deterministicActivityId(`${journalId}_in`),
      graphId,
      subjectId: subject,
      accountId: dest,
      direction: 'INFLOW',
      amount,
      occurredAt: event.occurredAt,
      counterpart: { kind: 'ACCOUNT', ref: source },
      classification: 'TRANSFER',
      sourceType: 'CANONICAL_LEDGER',
      sourceRef: journalId,
      sourceEventType: event.eventType,
      sourceEventId: eventIdOf(event),
    });
  }

  private projectInvestmentAccount(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const customerId = str(body.customerId);
    const investmentAccountId = str(body.investmentAccountId);
    const subject = subjectHint ?? customerId;
    if (!subject || !investmentAccountId) {
      return;
    }
    const graphId = this.ensureGraph(subject, customerId, event.occurredAt);
    const personId = deterministicNodeId('PERSON', subject);
    const nodeId = deterministicNodeId('INVESTMENT', investmentAccountId);
    this.upsertNode({
      nodeId,
      graphId,
      kind: 'INVESTMENT',
      attributes: {
        kind: 'INVESTMENT',
        holdingKind: 'SOLSTICE_HOLDING',
        label: investmentAccountId,
      },
      canonicalRef: { system: 'ACCOUNT', id: investmentAccountId },
      quality: 'CURRENT',
      confidence: 'DERIVED',
      provenance: provenance('CANONICAL_LEDGER', investmentAccountId, event.occurredAt, 'DERIVED'),
      createdAt: event.occurredAt,
      survivesRebuild: false,
    });
    this.upsertEdge(graphId, 'OWNS', personId, nodeId, event.occurredAt, 'CANONICAL_LEDGER', investmentAccountId, 'DERIVED');
    this.emit('EconomicGraphNodeCreated', graphId, event.occurredAt, { nodeId, kind: 'INVESTMENT' });
    this.emit('EconomicGraphRelationshipCreated', graphId, event.occurredAt, {
      kind: 'OWNS',
      from: personId,
      to: nodeId,
    });
  }

  private projectInvestmentHolding(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const instrumentId = str(body.instrumentId);
    const quantityUnits = str(body.quantityUnits);
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint ?? str(body.customerId);
    if (!instrumentId || !subject) {
      return;
    }
    const graphId = this.ensureGraph(subject, undefined, event.occurredAt);
    const accountNode = deterministicNodeId('INVESTMENT', str(body.investmentAccountId) ?? subject);
    const instrumentNode = deterministicNodeId('INVESTMENT', `instrument_${instrumentId}`);
    this.upsertNode({
      nodeId: instrumentNode,
      graphId,
      kind: 'INVESTMENT',
      attributes: {
        kind: 'INVESTMENT',
        holdingKind: 'SOLSTICE_HOLDING',
        label: instrumentId,
      },
      canonicalRef: { system: 'USER_DECLARATION', id: instrumentId },
      quality: 'CURRENT',
      confidence: 'DERIVED',
      provenance: provenance('CANONICAL_LEDGER', instrumentId, event.occurredAt, 'DERIVED'),
      createdAt: event.occurredAt,
      survivesRebuild: false,
    });
    this.upsertEdge(
      graphId,
      'INVESTED_IN',
      accountNode,
      instrumentNode,
      event.occurredAt,
      'CANONICAL_LEDGER',
      instrumentId,
      'DERIVED',
    );
    if (quantityUnits) {
      const factId = deterministicFactId(instrumentNode, 'position_quantity_units', 1);
      this.store.putFact({
        factId,
        graphId,
        nodeId: instrumentNode,
        key: 'position_quantity_units',
        value: { type: 'INT', value: quantityUnits },
        confidence: 'DERIVED',
        quality: 'CURRENT',
        provenance: provenance('CANONICAL_LEDGER', eventIdOf(event), event.occurredAt, 'DERIVED'),
        validFrom: event.occurredAt,
        validTo: null,
        observedAt: event.occurredAt,
        effectiveAt: event.occurredAt,
        supersededBy: null,
        version: 1,
        survivesRebuild: false,
      });
    }
    this.emit('EconomicGraphRelationshipCreated', graphId, event.occurredAt, {
      kind: 'INVESTED_IN',
      from: accountNode,
      to: instrumentNode,
    });
  }

  private projectPosition(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const accountId = str(body.accountId);
    const amount = this.amountFrom(body);
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint;
    if (!accountId || !amount || !subject) {
      return;
    }
    const graphId = this.ensureGraph(subject, undefined, event.occurredAt);
    const nodeId = this.ensureAccountNode(graphId, accountId, amount.currency, event.occurredAt);
    const factId = deterministicFactId(nodeId, 'derived_position', 1);
    const existing = this.store.factsForNode(nodeId, event.occurredAt).find((fact) => fact.key === 'derived_position');
    const next: EconomicFact = {
      factId,
      graphId,
      nodeId,
      key: 'derived_position',
      value: { type: 'MONEY', minorUnits: amount.minorUnits, currency: amount.currency },
      confidence: 'DERIVED',
      quality: 'CURRENT',
      provenance: provenance('CANONICAL_LEDGER', eventIdOf(event), event.occurredAt, 'DERIVED'),
      validFrom: event.occurredAt,
      validTo: null,
      observedAt: event.occurredAt,
      effectiveAt: event.occurredAt,
      supersededBy: null,
      version: existing ? existing.version + 1 : 1,
      survivesRebuild: false,
    };
    if (existing) {
      this.store.supersedeFact(existing.factId, {
        ...next,
        factId: deterministicFactId(nodeId, 'derived_position', existing.version + 1),
        version: existing.version + 1,
      });
    } else {
      this.store.putFact(next);
    }
    this.emit('EconomicGraphFactUpdated', graphId, event.occurredAt, { nodeId, key: 'derived_position' });
  }

  private projectPayment(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const paymentId = str(body.paymentId);
    const beneficiaryId = str(body.beneficiaryId);
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint;
    const amount = overlay?.amount ?? this.amountFrom(body) ?? this.paymentAmount(body);
    if (!paymentId || !subject || !amount) {
      return;
    }
    const graphId = this.ensureGraph(subject, undefined, event.occurredAt);
    const accountId = overlay?.accountId;
    if (accountId) {
      this.ensureAccountNode(graphId, accountId, amount.currency, event.occurredAt);
    }
    const counterpart: Counterpart = overlay?.counterpart ?? {
      kind: 'BENEFICIARY',
      ref: beneficiaryId ?? paymentId,
    };
    this.store.putActivity({
      activityId: deterministicActivityId(paymentId),
      graphId,
      subjectId: subject,
      ...(accountId ? { accountId } : {}),
      direction: overlay?.direction ?? 'OUTFLOW',
      amount,
      occurredAt: overlay?.occurredAt ?? event.occurredAt,
      counterpart,
      classification: overlay?.classification ?? 'PAYMENT',
      sourceType: 'SOLSTICE_PAYMENT',
      sourceRef: paymentId,
      sourceEventType: event.eventType,
      sourceEventId: eventIdOf(event),
    });
    this.linkCounterpart(
      graphId,
      subject,
      accountId,
      counterpart,
      overlay?.direction ?? 'OUTFLOW',
      event.occurredAt,
      paymentId,
      'SOLSTICE_PAYMENT',
    );
  }

  private projectCard(event: DomainEvent, subjectHint?: string): void {
    const body = payloadOf(event);
    const cardId = str(body.cardId);
    const merchantRef = str(body.merchantRef) ?? str(body.transactionRef) ?? cardId;
    const overlay = this.overlays.get(eventIdOf(event));
    const subject = overlay?.subjectId ?? subjectHint ?? str(body.customerId);
    const amount = overlay?.amount ?? this.amountFrom(body);
    if (!subject || !amount || !merchantRef) {
      return;
    }
    const graphId = this.ensureGraph(subject, str(body.customerId), event.occurredAt);
    const counterpart: Counterpart = overlay?.counterpart ?? { kind: 'MERCHANT', ref: merchantRef };
    this.store.putActivity({
      activityId: deterministicActivityId(eventIdOf(event)),
      graphId,
      subjectId: subject,
      direction: 'OUTFLOW',
      amount,
      occurredAt: event.occurredAt,
      counterpart,
      classification: overlay?.classification ?? 'CARD_SPEND',
      sourceType: 'SOLSTICE_CARD',
      sourceRef: eventIdOf(event),
      sourceEventType: event.eventType,
      sourceEventId: eventIdOf(event),
    });
    this.linkCounterpart(
      graphId,
      subject,
      undefined,
      counterpart,
      'OUTFLOW',
      event.occurredAt,
      eventIdOf(event),
      'SOLSTICE_CARD',
    );
  }

  private ensureAccountNode(
    graphId: EconomicGraphId,
    accountId: string,
    currency: string,
    at: UtcInstant,
  ): EconomicNodeId {
    const nodeId = deterministicNodeId('ACCOUNT', accountId);
    if (!this.store.getNode(nodeId)) {
      this.upsertNode({
        nodeId,
        graphId,
        kind: 'ACCOUNT',
        attributes: {
          kind: 'ACCOUNT',
          canonicalRef: { system: 'ACCOUNT', id: accountId },
          currency,
        },
        canonicalRef: { system: 'ACCOUNT', id: accountId },
        quality: 'CURRENT',
        confidence: 'VERIFIED',
        provenance: provenance('CANONICAL_LEDGER', accountId, at, 'VERIFIED'),
        createdAt: at,
        survivesRebuild: false,
      });
      const graph = this.store.getGraph(graphId);
      if (graph) {
        this.upsertEdge(
          graphId,
          'OWNS',
          deterministicNodeId('PERSON', graph.subjectId),
          nodeId,
          at,
          'CANONICAL_LEDGER',
          accountId,
          'VERIFIED',
        );
      }
    }
    return nodeId;
  }

  private linkCounterpart(
    graphId: EconomicGraphId,
    subjectId: string,
    accountId: string | undefined,
    counterpart: Counterpart,
    direction: 'INFLOW' | 'OUTFLOW',
    at: UtcInstant,
    sourceRef: string,
    sourceType: SourceType = 'CANONICAL_LEDGER',
  ): void {
    const personId = deterministicNodeId('PERSON', subjectId);
    const counterpartNodeId = this.ensureCounterpartNode(graphId, counterpart, at, sourceType, sourceRef);
    const edgeKind: EconomicEdgeKind = direction === 'INFLOW' ? 'RECEIVES_FROM' : 'PAYS_TO';
    this.upsertEdge(graphId, edgeKind, personId, counterpartNodeId, at, sourceType, sourceRef, 'VERIFIED');
    if (accountId) {
      this.upsertEdge(
        graphId,
        'FUNDS',
        deterministicNodeId('ACCOUNT', accountId),
        counterpartNodeId,
        at,
        sourceType,
        sourceRef,
        'VERIFIED',
      );
    }
    this.emit('EconomicGraphRelationshipCreated', graphId, at, {
      kind: edgeKind,
      from: personId,
      to: counterpartNodeId,
    });
  }

  private ensureCounterpartNode(
    graphId: EconomicGraphId,
    counterpart: Counterpart,
    at: UtcInstant,
    sourceType: SourceType,
    sourceRef: string,
  ): EconomicNodeId {
    const nodeId = deterministicNodeId('MERCHANT', `${counterpart.kind}_${counterpart.ref}`);
    if (!this.store.getNode(nodeId)) {
      const canonical: CanonicalRef =
        counterpart.kind === 'BENEFICIARY'
          ? { system: 'BENEFICIARY', id: counterpart.ref }
          : { system: 'CUSTOMER', id: counterpart.ref };
      this.upsertNode({
        nodeId,
        graphId,
        kind: 'MERCHANT',
        attributes: { kind: 'MERCHANT', merchantRef: counterpart.ref },
        canonicalRef: canonical,
        quality: 'CURRENT',
        confidence: sourceType === 'USER_DECLARED' ? 'USER_DECLARED' : 'VERIFIED',
        provenance: provenance(sourceType, sourceRef, at, sourceType === 'USER_DECLARED' ? 'USER_DECLARED' : 'VERIFIED'),
        createdAt: at,
        survivesRebuild: sourceType === 'USER_DECLARED',
      });
    }
    return nodeId;
  }

  private upsertNode(node: EconomicNode): void {
    if (!this.store.getNode(node.nodeId)) {
      this.store.putNode(node);
    }
  }

  private upsertEdge(
    graphId: EconomicGraphId,
    kind: EconomicEdgeKind,
    from: EconomicNodeId,
    to: EconomicNodeId,
    at: UtcInstant,
    sourceType: SourceType,
    sourceRef: string,
    confidence: FactConfidence,
  ): void {
    const edgeId = deterministicEdgeId(kind, from, to);
    if (this.store.getEdge(edgeId)) {
      return;
    }
    const edge: EconomicEdge = {
      edgeId,
      graphId,
      kind,
      fromNodeId: from,
      toNodeId: to,
      validFrom: at,
      validTo: null,
      quality: 'CURRENT',
      confidence,
      provenance: provenance(sourceType, sourceRef, at, confidence),
      createdAt: at,
      survivesRebuild: sourceType === 'USER_DECLARED',
    };
    this.store.putEdge(edge);
  }

  private amountFrom(body: Record<string, unknown>): SerializedMoney | undefined {
    const minor = str(body.amountMinorUnits) ?? str(body.sourceMinorUnits) ?? str(body.destinationMinorUnits);
    const currency = str(body.currency);
    if (!minor || !currency) {
      return undefined;
    }
    return { minorUnits: minor, currency };
  }

  private paymentAmount(body: Record<string, unknown>): SerializedMoney | undefined {
    const minor = str(body.sourceMinorUnits);
    if (!minor) {
      return undefined;
    }
    return { minorUnits: minor, currency: 'USD' };
  }

  private emit(
    eventType:
      | 'EconomicGraphNodeCreated'
      | 'EconomicGraphFactUpdated'
      | 'EconomicGraphRelationshipCreated'
      | 'EconomicGraphSnapshotCreated'
      | 'EconomicGraphOpportunityCreated',
    graphId: EconomicGraphId,
    occurredAt: UtcInstant,
    payload: Record<string, unknown>,
  ): void {
    this.events?.append({
      eventType,
      schemaVersion: 1,
      occurredAt,
      aggregateType: 'economic_graph',
      aggregateId: graphId,
      payload: { graphId, ...payload },
    } as DomainEvent);
  }

  emitPublic(
    eventType:
      | 'EconomicGraphNodeCreated'
      | 'EconomicGraphFactUpdated'
      | 'EconomicGraphRelationshipCreated'
      | 'EconomicGraphSnapshotCreated'
      | 'EconomicGraphOpportunityCreated',
    graphId: EconomicGraphId,
    occurredAt: UtcInstant,
    payload: Record<string, unknown>,
  ): void {
    this.emit(eventType, graphId, occurredAt, payload);
  }
}

export function nodeAttributes(node: EconomicNode): EconomicNodeAttributes {
  return node.attributes;
}

export { asEconomicSourceId };
