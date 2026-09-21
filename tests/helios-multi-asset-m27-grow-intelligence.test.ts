/**
 * HELIOS Multi-Asset Expansion M27 — Grow Intelligence, Morning Brief, Evening Recap.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildStructuredEveningRecap,
  buildStructuredMorningBrief,
  createFixtureFactsPort,
  createGrowNotificationEvent,
  DEFAULT_GROW_NOTIFICATION_PREFERENCES,
  evaluateGrowIntelligenceQualification,
  evaluateReportSchedule,
  fixtureGrowIntelligenceFacts,
  GrowIntelligenceService,
  GrowNotificationService,
  HELIOS_GROW_INTELLIGENCE_AUTHORITY,
  HELIOS_GROW_INTELLIGENCE_SCHEMA,
  HELIOS_MULTI_ASSET_M27,
  HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED,
  InMemoryGrowIntelligenceStore,
  summarizeReportSections,
} from '../packages/platform/src/helios/grow-intelligence/index.ts';
import {
  loadGrowIntelligenceState,
  persistGrowIntelligenceState,
} from '../packages/persistence/src/growth/pg-helios-grow-intelligence.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';

const CUSTOMER_A = 'cust_m27_a';
const CUSTOMER_B = 'cust_m27_b';
const SUBJECT_A = 'subj_m27_a';
const SUBJECT_B = 'subj_m27_b';
const PERIOD_START = asUtcInstant('2026-09-21T00:00:00.000Z');
const PERIOD_END = asUtcInstant('2026-09-21T23:59:59.000Z');
const MORNING_NOW = asUtcInstant('2026-09-21T12:00:00.000Z');
const EVENING_NOW = asUtcInstant('2026-09-21T19:00:00.000Z');

describe('HELIOS M27 Grow Intelligence', () => {
  it('exports M27 schema and chunk marker', () => {
    assert.equal(HELIOS_MULTI_ASSET_M27, 'HELIOS_MULTI_ASSET_M27');
    assert.equal(HELIOS_GROW_INTELLIGENCE_SCHEMA, 'sunrey.helios.grow-intelligence.v1');
    assert.equal(HELIOS_GROW_INTELLIGENCE_AUTHORITY, 'REFERENCE_ONLY');
  });

  it('architecture guard: grow-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/grow-intelligence'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('production safety: simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('builds structured morning brief before narrative generation', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'America/New_York',
      now: MORNING_NOW,
      scenario: 'morning_default',
    });
    const structured = buildStructuredMorningBrief({ facts, now: MORNING_NOW });
    assert.equal(structured.schema, 'sunrey.helios.grow.morning-brief.v1');
    assert.equal(structured.grantsExecutionAuthority, false);
    assert.equal(structured.noGuaranteedOutcomes, true);
    assert.ok(structured.activePositions.length > 0);
    assert.ok(structured.scheduledMarketEvents.length > 0);

    const narrative = summarizeReportSections('MORNING_BRIEF', structured, undefined);
    assert.equal(narrative.summarizerMode, 'DETERMINISTIC');
    assert.ok(narrative.sections.length > 0);
    assert.match(narrative.sections[0]!.body, /Grow capital/);
  });

  it('builds structured evening recap with deposits excluded from performance', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'America/New_York',
      now: EVENING_NOW,
      scenario: 'evening_with_deposit',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.equal(structured.depositsAreNotPerformance, true);
    assert.equal(BigInt(structured.principalDepositsExcluded.minorUnits), 500_000n);
    const narrative = summarizeReportSections('EVENING_RECAP', structured, undefined);
    assert.match(narrative.sections.map((s) => s.body).join(' '), /deposits were excluded/i);
  });

  it('profitable day recap reflects positive P&L without guaranteed outcome language', () => {
    const service = new GrowIntelligenceService({
      factsPort: createFixtureFactsPort('evening_profitable'),
    });
    service.setPreferences(CUSTOMER_A, {
      ...DEFAULT_GROW_NOTIFICATION_PREFERENCES,
      timeZone: 'UTC',
    });
    const report = service.generateReport({
      reportType: 'EVENING_RECAP',
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      now: EVENING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    const structured = report.structured as { realizedPnl: { minorUnits: string } };
    assert.ok(BigInt(structured.realizedPnl.minorUnits) > 0n);
    assert.doesNotMatch(report.summary, /guarantee/i);
  });

  it('losing day recap reflects negative P&L', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: EVENING_NOW,
      scenario: 'evening_losing',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.ok(BigInt(structured.realizedPnl.minorUnits) < 0n);
  });

  it('no-trade day includes rejected opportunity without counterfactual profit claim', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: EVENING_NOW,
      scenario: 'evening_no_trade',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.equal(structured.tradesOpened.length, 0);
    assert.equal(structured.tradesClosed.length, 0);
    assert.equal(structured.opportunitiesRejected.length, 1);
    assert.equal(structured.opportunitiesRejected[0]!.counterfactualProfitClaimPermitted, false);
    const narrative = summarizeReportSections('EVENING_RECAP', structured, undefined);
    assert.match(narrative.sections.map((s) => s.body).join(' '), /volatility threshold exceeded your current Grow mandate/i);
    assert.doesNotMatch(narrative.sections.map((s) => s.body).join(' '), /would have been profitable/i);
  });

  it('withdrawals appear in evening recap cash section', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: EVENING_NOW,
      scenario: 'evening_with_withdrawal',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.equal(BigInt(structured.withdrawals.minorUnits), 300_000n);
  });

  it('unsettled trade reduces withdrawable cash narrative', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: EVENING_NOW,
      scenario: 'evening_unsettled',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.equal(structured.tradesOpened[0]!.settlementState, 'UNSETTLED');
    const narrative = summarizeReportSections('EVENING_RECAP', structured, undefined);
    assert.match(narrative.sections.map((s) => s.body).join(' '), /unsettled/i);
  });

  it('risk block surfaces major risk interventions', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: EVENING_NOW,
      scenario: 'evening_risk_block',
    });
    const structured = buildStructuredEveningRecap({ facts, now: EVENING_NOW });
    assert.equal(structured.riskInterventions.length, 1);
    assert.equal(structured.riskInterventions[0]!.kind, 'NEW_ENTRIES_BLOCKED');
  });

  it('provider outage surfaces data limitations in morning brief', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: MORNING_NOW,
      scenario: 'evening_provider_outage',
    });
    const structured = buildStructuredMorningBrief({ facts, now: MORNING_NOW });
    assert.equal(structured.providerLimitations.length, 1);
  });

  it('paper-mode labeling appears in narratives', () => {
    const facts = fixtureGrowIntelligenceFacts({
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      reportingDate: '2026-09-21',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      timeZone: 'UTC',
      now: MORNING_NOW,
      scenario: 'paper_mode',
    });
    const structured = buildStructuredMorningBrief({ facts, now: MORNING_NOW });
    assert.equal(structured.executionMode, 'PAPER');
    const narrative = summarizeReportSections('MORNING_BRIEF', structured, undefined);
    assert.match(narrative.sections.map((s) => s.body).join(' '), /paper\/simulation/i);
  });

  it('missing AI summarizer falls back to deterministic narrative', () => {
    const service = new GrowIntelligenceService({
      factsPort: createFixtureFactsPort('morning_default'),
      summarizer: { available: false, summarize: () => [] },
    });
    const report = service.generateReport({
      reportType: 'MORNING_BRIEF',
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      now: MORNING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    assert.equal(report.summarizerMode, 'DETERMINISTIC');
    assert.equal(report.summarizerAvailable, false);
    assert.ok(report.narrativeSections.length > 0);
  });

  it('respects customer timezone for reporting date', () => {
    const utcLate = asUtcInstant('2026-09-21T04:30:00.000Z');
    const nySchedule = evaluateReportSchedule({
      reportType: 'MORNING_BRIEF',
      now: utcLate,
      prefs: { ...DEFAULT_GROW_NOTIFICATION_PREFERENCES, timeZone: 'America/New_York' },
    });
    assert.equal(nySchedule.reportingDate, '2026-09-21');
    assert.ok(nySchedule.nowMinutes >= 0);
  });

  it('disabled notification prevents delivery', () => {
    const notifications = new GrowNotificationService();
    notifications.setPreferences(CUSTOMER_A, {
      ...DEFAULT_GROW_NOTIFICATION_PREFERENCES,
      morningBriefEnabled: false,
    });
    const event = createGrowNotificationEvent({
      type: 'GROW_MORNING_BRIEF_AVAILABLE',
      occurredAt: MORNING_NOW,
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      resourceId: 'mbr_test',
      reportId: 'mbr_test',
      summary: 'Morning brief ready',
      userTitle: 'Morning brief',
      userBody: 'Ready',
    });
    const delivery = notifications.deliver(event, 8 * 60, MORNING_NOW);
    assert.equal(delivery, null);
  });

  it('duplicate delivery prevention blocks second notification', () => {
    const notifications = new GrowNotificationService();
    const event = createGrowNotificationEvent({
      type: 'GROW_EVENING_RECAP_AVAILABLE',
      occurredAt: EVENING_NOW,
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      resourceId: 'erc_test',
      reportId: 'erc_test',
      summary: 'Evening recap ready',
      userTitle: 'Evening recap',
      userBody: 'Ready',
    });
    const first = notifications.deliver(event, 19 * 60, EVENING_NOW);
    const second = notifications.deliver(event, 19 * 60, EVENING_NOW);
    assert.ok(first);
    assert.equal(second, null);
  });

  it('restart restores deduplication state', () => {
    const store = new InMemoryGrowIntelligenceStore();
    const notifications = new GrowNotificationService();
    const service = new GrowIntelligenceService({ factsPort: createFixtureFactsPort(), store, notifications });
    service.setPreferences(CUSTOMER_A, { ...DEFAULT_GROW_NOTIFICATION_PREFERENCES, timeZone: 'UTC' });
    const report = service.generateReport({
      reportType: 'MORNING_BRIEF',
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      now: MORNING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    service.emitReportNotification(report, MORNING_NOW);
    const snapshot = service.snapshot();
    const restarted = new GrowIntelligenceService({
      factsPort: createFixtureFactsPort(),
      store: new InMemoryGrowIntelligenceStore(),
      notifications: new GrowNotificationService(),
    });
    restarted.restore(snapshot);
    assert.equal(restarted.store.listReports(CUSTOMER_A).length, 1);
    assert.ok(restarted.notifications.isDuplicate(`GROW_MORNING_BRIEF_AVAILABLE:${CUSTOMER_A}:${report.reportId}:${report.reportId}`));
  });

  it('customer isolation keeps reports separate', () => {
    const service = new GrowIntelligenceService({ factsPort: createFixtureFactsPort() });
    service.generateReport({
      reportType: 'MORNING_BRIEF',
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      now: MORNING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    service.generateReport({
      reportType: 'MORNING_BRIEF',
      customerId: CUSTOMER_B,
      subjectId: SUBJECT_B,
      now: MORNING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    assert.equal(service.store.listReports(CUSTOMER_A).length, 1);
    assert.equal(service.store.listReports(CUSTOMER_B).length, 1);
    assert.notEqual(
      service.store.listReports(CUSTOMER_A)[0]!.reportId,
      service.store.listReports(CUSTOMER_B)[0]!.reportId,
    );
  });

  it('notification events are provider-neutral with external dependency truthfully marked', () => {
    const event = createGrowNotificationEvent({
      type: 'GROW_PROVIDER_DEGRADED',
      occurredAt: MORNING_NOW,
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      resourceId: 'provider_1',
      summary: 'Provider degraded',
      userTitle: 'Grow data degraded',
      userBody: 'One data provider is degraded.',
    });
    assert.equal(event.externalProviderRequired, true);
    assert.equal(event.deliveryAdapterAvailable, false);
    assert.deepEqual(event.channelHints, ['IN_APP', 'PUSH', 'EMAIL', 'SMS']);
  });

  it('emits HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED when checks pass', () => {
    const qualification = evaluateGrowIntelligenceQualification({
      morningBrief: true,
      eveningRecap: true,
      profitableDay: true,
      losingDay: true,
      noTradeDay: true,
      depositsExcluded: true,
      withdrawals: true,
      unsettledTrade: true,
      riskBlock: true,
      providerOutage: true,
      paperModeLabeling: true,
      missingAiSummarizerFallback: true,
      deterministicFallbackReport: true,
      timezoneRespected: true,
      disabledNotification: true,
      duplicateDeliveryPrevention: true,
      restart: true,
      customerIsolation: true,
      structuredBeforeNarrative: true,
      noExecutionAuthority: true,
      noCounterfactualProfitClaims: true,
    });
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.match(qualification.marker, /^HELIOS_MULTI_ASSET_M27_/);
  });

  it('persistence restart round-trip when PostgreSQL available', async () => {
    if (!persistenceAvailable()) {
      return;
    }
    const pool = await preparePersistence();
    const service = new GrowIntelligenceService({ factsPort: createFixtureFactsPort() });
    service.setPreferences(CUSTOMER_A, { ...DEFAULT_GROW_NOTIFICATION_PREFERENCES, timeZone: 'UTC' });
    const report = service.generateReport({
      reportType: 'EVENING_RECAP',
      customerId: CUSTOMER_A,
      subjectId: SUBJECT_A,
      now: EVENING_NOW,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    service.emitReportNotification(report, EVENING_NOW);
    await persistGrowIntelligenceState(pool, service.store.snapshot());
    const loaded = await loadGrowIntelligenceState(pool);
    assert.ok(loaded.reports.length >= 1);
    assert.ok(loaded.deliveries.length >= 1);
  });
});
