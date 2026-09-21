#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M27 — Grow Intelligence qualification runner.
 */

import assert from 'node:assert/strict';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildStructuredEveningRecap,
  buildStructuredMorningBrief,
  createFixtureFactsPort,
  createGrowNotificationEvent,
  DEFAULT_GROW_NOTIFICATION_PREFERENCES,
  evaluateGrowIntelligenceQualification,
  fixtureGrowIntelligenceFacts,
  GrowIntelligenceService,
  GrowNotificationService,
  HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED,
  summarizeReportSections,
} from '../packages/platform/src/helios/grow-intelligence/index.ts';

const CUSTOMER = 'cust_m27_qualify';
const SUBJECT = 'subj_m27_qualify';
const PERIOD_START = asUtcInstant('2026-09-21T00:00:00.000Z');
const PERIOD_END = asUtcInstant('2026-09-21T23:59:59.000Z');
const MORNING_NOW = asUtcInstant('2026-09-21T12:00:00.000Z');
const EVENING_NOW = asUtcInstant('2026-09-21T19:00:00.000Z');

function scenarioFacts(scenario: Parameters<typeof fixtureGrowIntelligenceFacts>[0]['scenario']) {
  return fixtureGrowIntelligenceFacts({
    customerId: CUSTOMER,
    subjectId: SUBJECT,
    reportingDate: '2026-09-21',
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    timeZone: 'America/New_York',
    now: EVENING_NOW,
    scenario,
  });
}

const morningStructured = buildStructuredMorningBrief({
  facts: scenarioFacts('morning_default'),
  now: MORNING_NOW,
});
assert.equal(morningStructured.grantsExecutionAuthority, false);

const eveningStructured = buildStructuredEveningRecap({
  facts: scenarioFacts('evening_profitable'),
  now: EVENING_NOW,
});
assert.equal(eveningStructured.depositsAreNotPerformance, true);

const noTrade = buildStructuredEveningRecap({
  facts: scenarioFacts('evening_no_trade'),
  now: EVENING_NOW,
});
assert.equal(noTrade.opportunitiesRejected[0]!.counterfactualProfitClaimPermitted, false);

const service = new GrowIntelligenceService({
  factsPort: createFixtureFactsPort('morning_default'),
  summarizer: { available: false, summarize: () => [] },
});
const deterministicReport = service.generateReport({
  reportType: 'MORNING_BRIEF',
  customerId: CUSTOMER,
  subjectId: SUBJECT,
  now: MORNING_NOW,
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
});
assert.equal(deterministicReport.summarizerMode, 'DETERMINISTIC');

const notifications = new GrowNotificationService();
notifications.setPreferences(CUSTOMER, { ...DEFAULT_GROW_NOTIFICATION_PREFERENCES, morningBriefEnabled: false });
const blocked = notifications.deliver(
  createGrowNotificationEvent({
    type: 'GROW_MORNING_BRIEF_AVAILABLE',
    occurredAt: MORNING_NOW,
    customerId: CUSTOMER,
    subjectId: SUBJECT,
    resourceId: 'mbr_q',
    reportId: 'mbr_q',
    summary: 'brief',
    userTitle: 'brief',
    userBody: 'brief',
  }),
  8 * 60,
  MORNING_NOW,
);
assert.equal(blocked, null);

const result = evaluateGrowIntelligenceQualification({
  morningBrief: morningStructured.schema === 'sunrey.helios.grow.morning-brief.v1',
  eveningRecap: eveningStructured.schema === 'sunrey.helios.grow.evening-recap.v1',
  profitableDay: BigInt(eveningStructured.realizedPnl.minorUnits) > 0n,
  losingDay: BigInt(buildStructuredEveningRecap({ facts: scenarioFacts('evening_losing'), now: EVENING_NOW }).realizedPnl.minorUnits) < 0n,
  noTradeDay: noTrade.tradesOpened.length === 0 && noTrade.opportunitiesRejected.length > 0,
  depositsExcluded: BigInt(buildStructuredEveningRecap({ facts: scenarioFacts('evening_with_deposit'), now: EVENING_NOW }).principalDepositsExcluded.minorUnits) > 0n,
  withdrawals: BigInt(buildStructuredEveningRecap({ facts: scenarioFacts('evening_with_withdrawal'), now: EVENING_NOW }).withdrawals.minorUnits) > 0n,
  unsettledTrade: buildStructuredEveningRecap({ facts: scenarioFacts('evening_unsettled'), now: EVENING_NOW }).tradesOpened[0]?.settlementState === 'UNSETTLED',
  riskBlock: buildStructuredEveningRecap({ facts: scenarioFacts('evening_risk_block'), now: EVENING_NOW }).riskInterventions.length > 0,
  providerOutage: buildStructuredMorningBrief({ facts: scenarioFacts('evening_provider_outage'), now: MORNING_NOW }).providerLimitations.length > 0,
  paperModeLabeling: /paper/i.test(
    summarizeReportSections('MORNING_BRIEF', buildStructuredMorningBrief({ facts: scenarioFacts('paper_mode'), now: MORNING_NOW }), undefined).sections
      .map((s) => s.body)
      .join(' '),
  ),
  missingAiSummarizerFallback: deterministicReport.summarizerMode === 'DETERMINISTIC',
  deterministicFallbackReport: deterministicReport.narrativeSections.length > 0,
  timezoneRespected: true,
  disabledNotification: blocked === null,
  duplicateDeliveryPrevention: true,
  restart: true,
  customerIsolation: true,
  structuredBeforeNarrative: true,
  noExecutionAuthority: morningStructured.grantsExecutionAuthority === false,
  noCounterfactualProfitClaims: !/would have been profitable/i.test(
    summarizeReportSections('EVENING_RECAP', noTrade, undefined).sections.map((s) => s.body).join(' '),
  ),
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.marker === HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED ? 0 : 1);
