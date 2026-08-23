import type { ComplianceCase, HumanDecision } from '../compliance/cases.ts';
import type {
  OperationalCase,
  OperatorActionRecord,
  SupportViewSession,
  TimelineEntry,
} from './types.ts';
import type {
  AgentOpsView,
  CustodyOpsView,
  PaymentOpsView,
  ProviderOpsView,
  ReconciliationOpsView,
  SecurityOpsView,
  SupportCustomerView,
  SurveillanceOpsView,
  TreasuryOpsView,
} from './reads.ts';

export type OperationsSnapshot = {
  readonly cases: readonly OperationalCase[];
  readonly specialized: readonly ComplianceCase[];
  readonly decisions: readonly HumanDecision[];
  readonly actions: readonly OperatorActionRecord[];
  readonly supportSessions: readonly SupportViewSession[];
  readonly timeline: readonly TimelineEntry[];
  readonly payments: readonly PaymentOpsView[];
  readonly treasury: readonly TreasuryOpsView[];
  readonly breaks: readonly ReconciliationOpsView[];
  readonly surveillance: readonly SurveillanceOpsView[];
  readonly custody: readonly CustodyOpsView[];
  readonly providers: readonly ProviderOpsView[];
  readonly agents: readonly AgentOpsView[];
  readonly security: readonly SecurityOpsView[];
  readonly supportProfiles: readonly SupportCustomerView[];
};

export const EMPTY_OPERATIONS_SNAPSHOT: OperationsSnapshot = Object.freeze({
  cases: Object.freeze([]),
  specialized: Object.freeze([]),
  decisions: Object.freeze([]),
  actions: Object.freeze([]),
  supportSessions: Object.freeze([]),
  timeline: Object.freeze([]),
  payments: Object.freeze([]),
  treasury: Object.freeze([]),
  breaks: Object.freeze([]),
  surveillance: Object.freeze([]),
  custody: Object.freeze([]),
  providers: Object.freeze([]),
  agents: Object.freeze([]),
  security: Object.freeze([]),
  supportProfiles: Object.freeze([]),
});

export class OperationsStore {
  readonly cases = new Map<string, OperationalCase>();
  readonly specialized = new Map<string, ComplianceCase>();
  readonly decisions = new Map<string, HumanDecision>();
  readonly actions = new Map<string, OperatorActionRecord>();
  readonly supportSessions = new Map<string, SupportViewSession>();
  timeline: TimelineEntry[] = [];
  readonly payments = new Map<string, PaymentOpsView>();
  readonly treasury = new Map<string, TreasuryOpsView>();
  readonly breaks = new Map<string, ReconciliationOpsView>();
  readonly surveillance = new Map<string, SurveillanceOpsView>();
  readonly custody = new Map<string, CustodyOpsView>();
  readonly providers = new Map<string, ProviderOpsView>();
  readonly agents = new Map<string, AgentOpsView>();
  readonly security = new Map<string, SecurityOpsView>();
  readonly supportProfiles = new Map<string, SupportCustomerView>();

  hydrate(snapshot: OperationsSnapshot): void {
    this.cases.clear();
    this.specialized.clear();
    this.decisions.clear();
    this.actions.clear();
    this.supportSessions.clear();
    this.payments.clear();
    this.treasury.clear();
    this.breaks.clear();
    this.surveillance.clear();
    this.custody.clear();
    this.providers.clear();
    this.agents.clear();
    this.security.clear();
    this.supportProfiles.clear();
    for (const row of snapshot.cases) this.cases.set(row.caseId, Object.freeze({ ...row }));
    for (const row of snapshot.specialized) this.specialized.set(row.caseId, Object.freeze({ ...row }));
    for (const row of snapshot.decisions) this.decisions.set(row.decisionId, Object.freeze({ ...row }));
    for (const row of snapshot.actions) this.actions.set(row.actionId, Object.freeze({ ...row }));
    for (const row of snapshot.supportSessions) this.supportSessions.set(row.sessionId, Object.freeze({ ...row }));
    this.timeline = snapshot.timeline.map((row) => Object.freeze({ ...row }));
    for (const row of snapshot.payments) this.payments.set(row.paymentId, Object.freeze({ ...row }));
    for (const row of snapshot.treasury) this.treasury.set(row.providerId, Object.freeze({ ...row }));
    for (const row of snapshot.breaks) this.breaks.set(row.breakId, Object.freeze({ ...row }));
    for (const row of snapshot.surveillance) this.surveillance.set(row.alertId, Object.freeze({ ...row }));
    for (const row of snapshot.custody) this.custody.set(row.walletId, Object.freeze({ ...row }));
    for (const row of snapshot.providers) this.providers.set(row.providerId, Object.freeze({ ...row }));
    for (const row of snapshot.agents) this.agents.set(row.agentId, Object.freeze({ ...row }));
    for (const row of snapshot.security) this.security.set(row.eventId, Object.freeze({ ...row }));
    for (const row of snapshot.supportProfiles) this.supportProfiles.set(row.customerId, Object.freeze({ ...row }));
  }

  snapshot(): OperationsSnapshot {
    return Object.freeze({
      cases: Object.freeze([...this.cases.values()]),
      specialized: Object.freeze([...this.specialized.values()]),
      decisions: Object.freeze([...this.decisions.values()]),
      actions: Object.freeze([...this.actions.values()]),
      supportSessions: Object.freeze([...this.supportSessions.values()]),
      timeline: Object.freeze([...this.timeline]),
      payments: Object.freeze([...this.payments.values()]),
      treasury: Object.freeze([...this.treasury.values()]),
      breaks: Object.freeze([...this.breaks.values()]),
      surveillance: Object.freeze([...this.surveillance.values()]),
      custody: Object.freeze([...this.custody.values()]),
      providers: Object.freeze([...this.providers.values()]),
      agents: Object.freeze([...this.agents.values()]),
      security: Object.freeze([...this.security.values()]),
      supportProfiles: Object.freeze([...this.supportProfiles.values()]),
    });
  }

  putCase(row: OperationalCase): void {
    this.cases.set(row.caseId, Object.freeze({ ...row }));
  }
}
