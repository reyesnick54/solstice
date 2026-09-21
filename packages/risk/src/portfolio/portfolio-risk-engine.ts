import { createHash } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import { ratioCmp, shareOf, type Ratio } from '../arithmetic.ts';
import type { RiskEngine } from '../engine.ts';
import { computePortfolioDrawdown, rollDailyLossLedger, utcDayKey } from './drawdown-accounting.ts';
import { buildExposureGraph } from './exposure-graph.ts';
import {
  actionsForState,
  detectKillTriggers,
  emergencyClosePermitted,
  maxRiskState,
  mergeTriggerStates,
  newEntriesPermitted,
  stateFromDrawdown,
} from './kill-control.ts';
import { policyUpdatePermitted } from './mandate-policy.ts';
import { PortfolioRiskStore } from './store.ts';
import type {
  KillControlTrigger,
  MandateRiskPolicy,
  PortfolioExposureAssessment,
  PortfolioPositionRiskFact,
  PortfolioRiskContext,
  PortfolioRiskEvaluation,
  PortfolioRiskState,
  PortfolioRiskStateRecord,
  RiskActionKind,
  RiskInterventionEvidence,
} from './types.ts';

function hashId(prefix: string, material: string): string {
  return `${prefix}${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

function totalEquityMinor(context: PortfolioRiskContext): bigint {
  const positions = context.positions.reduce((sum, row) => sum + row.marketValueMinor, 0n);
  return positions + context.brokerageCashMinor;
}

function staleDataPresent(positions: readonly PortfolioPositionRiskFact[]): boolean {
  return positions.some((row) => row.priceQuality === 'STALE' || row.priceQuality === 'MISSING');
}

function breachedExposureRules(input: {
  readonly policy: MandateRiskPolicy;
  readonly exposure: PortfolioExposureAssessment;
  readonly totalEquityMinor: bigint;
  readonly context: PortfolioRiskContext;
}): readonly string[] {
  const breached: string[] = [];
  const { policy, exposure, totalEquityMinor } = input;
  const denominator = totalEquityMinor > 0n ? totalEquityMinor : 1n;

  for (const position of input.context.positions) {
    const ratio = shareOf(
      position.marketValueMinor < 0n ? -position.marketValueMinor : position.marketValueMinor,
      denominator,
    );
    if (policy.maximumPositionExposure && ratioCmp(ratio, policy.maximumPositionExposure) > 0) {
      breached.push(`POSITION_CAP:${position.instrumentId}`);
    }
  }

  for (const strategy of exposure.strategyExposures) {
    const ratio = shareOf(strategy.grossExposureMinor, denominator);
    if (policy.maximumStrategyExposure && ratioCmp(ratio, policy.maximumStrategyExposure) > 0) {
      breached.push(`STRATEGY_CAP:${strategy.strategyId}`);
    }
    const strategyDrawdown = input.context.strategyDrawdowns.find((row) => row.strategyId === strategy.strategyId);
    if (
      policy.maximumStrategyDrawdown &&
      strategyDrawdown &&
      ratioCmp(strategyDrawdown.drawdownRatio, policy.maximumStrategyDrawdown) > 0
    ) {
      breached.push(`STRATEGY_DRAWDOWN:${strategy.strategyId}`);
    }
  }

  for (const [assetClass, value] of Object.entries(exposure.assetClassExposures)) {
    const ratio = shareOf(value, denominator);
    if (policy.maximumAssetClassExposure && ratioCmp(ratio, policy.maximumAssetClassExposure) > 0) {
      breached.push(`ASSET_CLASS_CAP:${assetClass}`);
    }
    if (assetClass === 'CRYPTO' && policy.maximumCryptoExposure && ratioCmp(ratio, policy.maximumCryptoExposure) > 0) {
      breached.push('CRYPTO_CAP');
    }
    if (assetClass === 'COMMODITY' && policy.maximumCommodityExposure && ratioCmp(ratio, policy.maximumCommodityExposure) > 0) {
      breached.push('COMMODITY_CAP');
    }
  }

  for (const cluster of exposure.clusterExposures) {
    if (
      policy.maximumCorrelatedClusterExposure &&
      ratioCmp(cluster.exposureRatio, policy.maximumCorrelatedClusterExposure) > 0
    ) {
      breached.push(`CORRELATION_CLUSTER_CAP:${cluster.clusterId}`);
    }
  }

  for (const venue of exposure.venueExposures) {
    const ratio = shareOf(venue.exposureMinor, denominator);
    if (policy.maximumVenueConcentration && ratioCmp(ratio, policy.maximumVenueConcentration) > 0) {
      breached.push(`VENUE_CAP:${venue.venue}`);
    }
  }

  const grossRatio = shareOf(exposure.grossExposureMinor, denominator);
  if (policy.maximumGrossExposure && ratioCmp(grossRatio, policy.maximumGrossExposure) > 0) {
    breached.push('GROSS_EXPOSURE');
  }

  const netAbs = exposure.netExposureMinor < 0n ? -exposure.netExposureMinor : exposure.netExposureMinor;
  const netRatio = shareOf(netAbs, denominator);
  if (policy.maximumNetExposure && ratioCmp(netRatio, policy.maximumNetExposure) > 0) {
    breached.push('NET_EXPOSURE');
  }

  if (
    policy.maximumConsecutiveLosses !== undefined &&
    input.context.dailyLoss.consecutiveLossCount > policy.maximumConsecutiveLosses
  ) {
    breached.push('CONSECUTIVE_LOSSES');
  }

  return Object.freeze(breached);
}

function deriveState(input: {
  readonly context: PortfolioRiskContext;
  readonly policy: MandateRiskPolicy;
  readonly portfolioDrawdown: Ratio | null;
  readonly triggers: readonly KillControlTrigger[];
  readonly breachedRules: readonly string[];
}): PortfolioRiskState {
  let state: PortfolioRiskState = 'NORMAL';
  if (input.context.customerPaused) {
    state = maxRiskState(state, 'PAUSED');
  }
  if (input.context.compliancePaused) {
    state = maxRiskState(state, 'PAUSED');
  }
  state = maxRiskState(state, mergeTriggerStates(input.triggers));
  state = maxRiskState(state, stateFromDrawdown(input.portfolioDrawdown, input.policy));
  if (input.breachedRules.some((rule) => rule.startsWith('CORRELATION_CLUSTER_CAP:'))) {
    state = maxRiskState(state, 'NEW_ENTRIES_BLOCKED');
  }
  if (input.breachedRules.some((rule) => rule.startsWith('POSITION_CAP:') || rule.startsWith('ASSET_CLASS_CAP:'))) {
    state = maxRiskState(state, 'NEW_ENTRIES_BLOCKED');
  }
  return state;
}

function primaryAction(state: PortfolioRiskState, policy: MandateRiskPolicy): RiskActionKind {
  const actions = actionsForState(state, policy);
  return actions[actions.length - 1] ?? 'BLOCK_NEW_ENTRIES';
}

export class PortfolioRiskEngine {
  private readonly clock: Clock;
  readonly store: PortfolioRiskStore;
  private readonly riskEngine: RiskEngine | undefined;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;

  constructor(input: {
    readonly clock: Clock;
    readonly store?: PortfolioRiskStore;
    readonly riskEngine?: RiskEngine;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
  }) {
    this.clock = input.clock;
    this.store = input.store ?? new PortfolioRiskStore();
    this.riskEngine = input.riskEngine;
    this.events = input.events;
    this.evidence = input.evidence;
  }

  putPolicy(policy: MandateRiskPolicy): void {
    const current = this.store.latestPolicy(policy.mandateId);
    if (current) {
      const check = policyUpdatePermitted(current, policy);
      if (!check.permitted) {
        throw new Error(`policy update rejected: ${check.reasons.join(', ')}`);
      }
    }
    this.store.putPolicy(Object.freeze({ ...policy, cannotLoosenMandate: true, engineeringOnly: true }));
  }

  initializeState(mandateId: string, portfolioId: string, policyVersion: MandateRiskPolicy['version']): PortfolioRiskStateRecord {
    const record = Object.freeze({
      mandateId,
      portfolioId,
      state: 'NORMAL' as const,
      activeTriggers: Object.freeze([]),
      updatedAt: this.clock.now(),
      policyVersion,
      lastInterventionId: null,
      customerPaused: false,
      compliancePaused: false,
    });
    this.store.putState(record);
    return record;
  }

  applyKillTrigger(input: {
    readonly mandateId: string;
    readonly trigger: KillControlTrigger;
    readonly authority: string;
    readonly evidenceRefs?: readonly string[];
    readonly affectedStrategyId?: string | null;
    readonly affectedInstrumentId?: string | null;
  }): PortfolioRiskEvaluation {
    const policy = this.store.latestPolicy(input.mandateId);
    if (!policy) {
      throw new Error(`no policy for mandate ${input.mandateId}`);
    }
    const prior = this.store.getState(input.mandateId) ?? this.initializeState(input.mandateId, policy.portfolioId, policy.version);
    const nextState = maxRiskState(prior.state, mergeTriggerStates([input.trigger]));
    const triggers = Object.freeze([...new Set([...prior.activeTriggers, input.trigger])]);
    const stateRecord = Object.freeze({
      ...prior,
      state: nextState,
      activeTriggers: triggers,
      updatedAt: this.clock.now(),
      customerPaused: input.trigger === 'CUSTOMER_PAUSE' ? true : prior.customerPaused,
      compliancePaused: input.trigger === 'COMPLIANCE_PAUSE' ? true : prior.compliancePaused,
    });
    this.store.putState(stateRecord);
    const intervention = this.recordIntervention({
      mandateId: input.mandateId,
      portfolioId: policy.portfolioId,
      policy,
      priorState: prior.state,
      nextState,
      rule: `KILL_CONTROL:${input.trigger}`,
      threshold: 'policy',
      observedValue: input.trigger,
      action: primaryAction(nextState, policy),
      authority: input.authority,
      evidenceRefs: input.evidenceRefs ?? [],
      trigger: input.trigger,
      affectedStrategyId: input.affectedStrategyId ?? null,
      affectedInstrumentId: input.affectedInstrumentId ?? null,
    });
    return this.buildEvaluation({
      policy,
      priorState: prior.state,
      state: nextState,
      exposure: emptyExposure(),
      breachedRules: Object.freeze([`KILL_CONTROL:${input.trigger}`]),
      intervention,
    });
  }

  clearKillTrigger(mandateId: string, trigger: KillControlTrigger, authority: string): PortfolioRiskStateRecord {
    const prior = this.store.getState(mandateId);
    if (!prior) {
      throw new Error(`no state for mandate ${mandateId}`);
    }
    const triggers = prior.activeTriggers.filter((row) => row !== trigger);
    const policy = this.store.latestPolicy(mandateId);
    const record = Object.freeze({
      ...prior,
      activeTriggers: Object.freeze(triggers),
      state: mergeTriggerStates(triggers),
      updatedAt: this.clock.now(),
      customerPaused: trigger === 'CUSTOMER_PAUSE' ? false : prior.customerPaused,
      compliancePaused: trigger === 'COMPLIANCE_PAUSE' ? false : prior.compliancePaused,
    });
    this.store.putState(record);
    if (policy) {
      this.recordIntervention({
        mandateId,
        portfolioId: prior.portfolioId,
        policy,
        priorState: prior.state,
        nextState: record.state,
        rule: `KILL_CONTROL_CLEAR:${trigger}`,
        threshold: 'n/a',
        observedValue: 'cleared',
        action: actionsForState(record.state, policy)[0] ?? 'ALLOW_NEW_ENTRIES',
        authority,
        evidenceRefs: Object.freeze([]),
        trigger: null,
        affectedStrategyId: null,
        affectedInstrumentId: null,
      });
    }
    return record;
  }

  clearCustomerPause(mandateId: string, authority: string): PortfolioRiskStateRecord {
    const prior = this.store.getState(mandateId);
    if (!prior) {
      throw new Error(`no state for mandate ${mandateId}`);
    }
    return this.clearKillTrigger(mandateId, 'CUSTOMER_PAUSE', authority);
  }

  evaluatePortfolio(context: PortfolioRiskContext, policy: MandateRiskPolicy): PortfolioRiskEvaluation {
    const prior = this.store.getState(context.mandateId) ?? this.initializeState(context.mandateId, context.portfolioId, policy.version);
    const equity = totalEquityMinor(context);
    const exposureBase = buildExposureGraph({
      positions: context.positions,
      profiles: context.instrumentProfiles,
      totalEquityMinor: equity,
    });
    const portfolioDrawdown = computePortfolioDrawdown(context.reconciledEquity);
    const exposure: PortfolioExposureAssessment = Object.freeze({
      ...exposureBase,
      portfolioDrawdown,
      liquidityMinor: context.brokerageCashMinor,
    });
    const stale = staleDataPresent(context.positions);
    const detectedTriggers = detectKillTriggers({ context, policy, portfolioDrawdown, staleDataPresent: stale });
    const triggers = Object.freeze([...new Set([...prior.activeTriggers, ...detectedTriggers])]);
    const breachedRules = breachedExposureRules({ policy, exposure, totalEquityMinor: equity, context });
    const state = deriveState({
      context,
      policy,
      portfolioDrawdown,
      triggers,
      breachedRules,
    });

    let intervention: RiskInterventionEvidence | null = null;
    if (state !== prior.state || breachedRules.length > 0 || triggers.length > 0) {
      intervention = this.recordIntervention({
        mandateId: context.mandateId,
        portfolioId: context.portfolioId,
        policy,
        priorState: prior.state,
        nextState: state,
        rule: breachedRules[0] ?? triggers[0] ?? 'PORTFOLIO_EVALUATION',
        threshold: primaryThreshold(policy, breachedRules[0] ?? null),
        observedValue: primaryObserved({ portfolioDrawdown, breachedRules, exposure }),
        action: primaryAction(state, policy),
        authority: 'PortfolioRiskEngine',
        evidenceRefs: Object.freeze([...context.sourceRefs]),
        trigger: triggers[0] ?? null,
        affectedStrategyId: strategyFromRule(breachedRules[0]),
        affectedInstrumentId: instrumentFromRule(breachedRules[0]),
      });
    }

    this.store.putState(
      Object.freeze({
        ...prior,
        state,
        activeTriggers: triggers,
        updatedAt: context.asOf,
        policyVersion: policy.version,
        lastInterventionId: intervention?.interventionId ?? prior.lastInterventionId,
        customerPaused: prior.customerPaused,
        compliancePaused: prior.compliancePaused,
      }),
    );

    return this.buildEvaluation({
      policy,
      priorState: prior.state,
      state,
      exposure,
      breachedRules,
      intervention,
    });
  }

  assessStrategyEntry(input: {
    readonly context: PortfolioRiskContext;
    readonly policy: MandateRiskPolicy;
    readonly strategyId: string;
    readonly instrumentId: string;
    readonly proposedNotionalMinor: bigint;
  }): { readonly permitted: boolean; readonly evaluation: PortfolioRiskEvaluation; readonly reason: string } {
    const evaluation = this.evaluatePortfolio(input.context, input.policy);
    if (!newEntriesPermitted(evaluation.state)) {
      return Object.freeze({
        permitted: false,
        evaluation,
        reason: `new entries blocked in state ${evaluation.state}`,
      });
    }
    if (evaluation.breachedRules.length > 0) {
      return Object.freeze({
        permitted: false,
        evaluation,
        reason: evaluation.breachedRules.join(','),
      });
    }
    if (this.riskEngine) {
      // Canonical pre-trade Risk Engine remains authoritative for instrument-level checks.
    }
    return Object.freeze({ permitted: true, evaluation, reason: 'permitted' });
  }

  handlePartialFillDuringRiskEvent(input: {
    readonly context: PortfolioRiskContext;
    readonly policy: MandateRiskPolicy;
    readonly filledNotionalMinor: bigint;
    readonly remainingNotionalMinor: bigint;
  }): PortfolioRiskEvaluation {
    const evaluation = this.evaluatePortfolio(input.context, input.policy);
    const action =
      evaluation.state === 'EXIT_ONLY' || evaluation.state === 'EMERGENCY_CLOSE_REQUIRED'
        ? 'EXIT_STRATEGY'
        : 'REDUCE_EXPOSURE';
    this.recordIntervention({
      mandateId: input.context.mandateId,
      portfolioId: input.context.portfolioId,
      policy: input.policy,
      priorState: evaluation.priorState,
      nextState: evaluation.state,
      rule: 'PARTIAL_FILL_DURING_RISK_EVENT',
      threshold: input.remainingNotionalMinor.toString(),
      observedValue: input.filledNotionalMinor.toString(),
      action,
      authority: 'PortfolioRiskEngine',
      evidenceRefs: Object.freeze([...input.context.sourceRefs]),
      trigger: evaluation.intervention?.trigger ?? null,
      affectedStrategyId: null,
      affectedInstrumentId: null,
    });
    return evaluation;
  }

  restoreState(mandateId: string): PortfolioRiskStateRecord | undefined {
    return this.store.getState(mandateId);
  }

  updateDailyLoss(input: {
    readonly mandateId: string;
    readonly now: import('../../../domain/src/time.ts').UtcInstant;
    readonly realizedPnlMinor: bigint;
    readonly totalPnlMinor: bigint;
    readonly priorLedger: import('./types.ts').DailyLossLedger | null;
  }): import('./types.ts').DailyLossLedger {
    const ledger = rollDailyLossLedger({
      prior: input.priorLedger,
      now: input.now,
      realizedPnlMinor: input.realizedPnlMinor,
      totalPnlMinor: input.totalPnlMinor,
    });
    if (input.priorLedger && input.priorLedger.utcDay !== utcDayKey(input.now)) {
      // Midnight rollover resets day-scoped counters without resetting portfolio risk state.
    }
    return ledger;
  }

  private buildEvaluation(input: {
    readonly policy: MandateRiskPolicy;
    readonly priorState: PortfolioRiskState;
    readonly state: PortfolioRiskState;
    readonly exposure: PortfolioExposureAssessment;
    readonly breachedRules: readonly string[];
    readonly intervention: RiskInterventionEvidence | null;
  }): PortfolioRiskEvaluation {
    const material = JSON.stringify({
      mandateId: input.policy.mandateId,
      policyVersion: input.policy.version,
      state: input.state,
      breached: input.breachedRules,
      at: this.clock.now(),
    });
    const evaluation = Object.freeze({
      evaluationId: hashId('pre_', material),
      mandateId: input.policy.mandateId,
      portfolioId: input.policy.portfolioId,
      policyVersion: input.policy.version,
      state: input.state,
      priorState: input.priorState,
      exposure: input.exposure,
      breachedRules: input.breachedRules,
      recommendedActions: actionsForState(input.state, input.policy),
      newEntriesPermitted: newEntriesPermitted(input.state) && input.breachedRules.length === 0,
      exitsPermitted: true as const,
      emergencyClosePermitted: emergencyClosePermitted(input.state, input.policy),
      intervention: input.intervention,
      evaluatedAt: this.clock.now(),
    });
    this.emit('PortfolioRiskEvaluated', evaluation.evaluationId, {
      mandateId: evaluation.mandateId,
      state: evaluation.state,
      breachedRules: evaluation.breachedRules,
    });
    if (input.intervention) {
      this.evidence?.seal('PORTFOLIO_RISK_INTERVENTION', {
        interventionId: input.intervention.interventionId,
        rule: input.intervention.rule,
        threshold: input.intervention.threshold,
        observedValue: input.intervention.observedValue,
        action: input.intervention.resultingAction,
        authority: input.intervention.authority,
      });
    }
    return evaluation;
  }

  private recordIntervention(input: {
    readonly mandateId: string;
    readonly portfolioId: string;
    readonly policy: MandateRiskPolicy;
    readonly priorState: PortfolioRiskState;
    readonly nextState: PortfolioRiskState;
    readonly rule: string;
    readonly threshold: string;
    readonly observedValue: string;
    readonly action: RiskActionKind;
    readonly authority: string;
    readonly evidenceRefs: readonly string[];
    readonly trigger: KillControlTrigger | null;
    readonly affectedStrategyId: string | null;
    readonly affectedInstrumentId: string | null;
  }): RiskInterventionEvidence {
    const material = JSON.stringify({
      mandateId: input.mandateId,
      rule: input.rule,
      at: this.clock.now(),
      next: input.nextState,
    });
    const intervention = Object.freeze({
      interventionId: hashId('pri_', material),
      mandateId: input.mandateId,
      portfolioId: input.portfolioId,
      rule: input.rule,
      threshold: input.threshold,
      observedValue: input.observedValue,
      observedAt: this.clock.now(),
      affectedStrategyId: input.affectedStrategyId,
      affectedInstrumentId: input.affectedInstrumentId,
      resultingAction: input.action,
      authority: input.authority,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      trigger: input.trigger,
      policyVersion: input.policy.version,
      priorState: input.priorState,
      nextState: input.nextState,
    });
    this.store.putIntervention(intervention);
    this.emit('PortfolioRiskIntervention', intervention.interventionId, {
      interventionId: intervention.interventionId,
      rule: intervention.rule,
      action: intervention.resultingAction,
    });
    return intervention;
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'portfolio_risk',
      aggregateId,
    } as never);
  }
}

function emptyExposure(): PortfolioExposureAssessment {
  return Object.freeze({
    grossExposureMinor: 0n,
    netExposureMinor: 0n,
    strategyExposures: Object.freeze([]),
    venueExposures: Object.freeze([]),
    clusterExposures: Object.freeze([]),
    assetClassExposures: Object.freeze({} as Readonly<Record<'EQUITY', bigint>>),
    portfolioDrawdown: null,
    liquidityMinor: 0n,
  });
}

function primaryThreshold(policy: MandateRiskPolicy, rule: string | null): string {
  if (!rule) {
    return 'n/a';
  }
  if (rule.startsWith('CORRELATION_CLUSTER_CAP:')) {
    return policy.maximumCorrelatedClusterExposure?.units.toString() ?? 'unset';
  }
  if (rule.startsWith('POSITION_CAP:')) {
    return policy.maximumPositionExposure?.units.toString() ?? 'unset';
  }
  if (rule.startsWith('ASSET_CLASS_CAP:')) {
    return policy.maximumAssetClassExposure?.units.toString() ?? 'unset';
  }
  return 'policy';
}

function primaryObserved(input: {
  readonly portfolioDrawdown: Ratio | null;
  readonly breachedRules: readonly string[];
  readonly exposure: PortfolioExposureAssessment;
}): string {
  if (input.portfolioDrawdown) {
    return input.portfolioDrawdown.units.toString();
  }
  if (input.breachedRules[0]?.startsWith('CORRELATION_CLUSTER_CAP:')) {
    const clusterId = input.breachedRules[0].slice('CORRELATION_CLUSTER_CAP:'.length);
    const cluster = input.exposure.clusterExposures.find((row) => row.clusterId === clusterId);
    return cluster?.exposureRatio.units.toString() ?? 'unknown';
  }
  return input.breachedRules[0] ?? 'none';
}

function strategyFromRule(rule: string | undefined): string | null {
  if (!rule?.startsWith('STRATEGY_')) {
    return null;
  }
  const parts = rule.split(':');
  return parts[1] ?? null;
}

function instrumentFromRule(rule: string | undefined): string | null {
  if (!rule?.startsWith('POSITION_CAP:')) {
    return null;
  }
  return rule.slice('POSITION_CAP:'.length);
}
