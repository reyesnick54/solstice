import type { UtcInstant } from '@solstice/domain';
import { buildStructuredEveningRecap } from './evening-recap.ts';
import { buildStructuredMorningBrief } from './morning-brief.ts';
import { buildReportSummary, summarizeReportSections } from './narrative.ts';
import {
  createGrowNotificationEvent,
  GrowNotificationService,
} from './notifications.ts';
import { evaluateReportSchedule } from './scheduler.ts';
import { InMemoryGrowIntelligenceStore } from './store.ts';
import type {
  GrowIntelligenceFactsPort,
  GrowIntelligenceReport,
  GrowIntelligenceSummarizerPort,
  GrowNotificationDeliveryAdapter,
  GrowNotificationEvent,
  GrowNotificationPreferences,
  GrowReportType,
} from './types.ts';

export type GrowIntelligenceServiceOptions = {
  readonly factsPort: GrowIntelligenceFactsPort;
  readonly store?: InMemoryGrowIntelligenceStore;
  readonly notifications?: GrowNotificationService;
  readonly summarizer?: GrowIntelligenceSummarizerPort;
  readonly deliveryAdapter?: GrowNotificationDeliveryAdapter;
};

export class GrowIntelligenceService {
  readonly factsPort: GrowIntelligenceFactsPort;
  readonly store: InMemoryGrowIntelligenceStore;
  readonly notifications: GrowNotificationService;
  readonly summarizer: GrowIntelligenceSummarizerPort | undefined;
  readonly deliveryAdapter: GrowNotificationDeliveryAdapter | undefined;

  constructor(options: GrowIntelligenceServiceOptions) {
    this.factsPort = options.factsPort;
    this.store = options.store ?? new InMemoryGrowIntelligenceStore();
    this.notifications = options.notifications ?? new GrowNotificationService();
    this.summarizer = options.summarizer;
    this.deliveryAdapter = options.deliveryAdapter;
  }

  setPreferences(customerId: string, prefs: GrowNotificationPreferences): void {
    this.notifications.setPreferences(customerId, prefs);
    this.store.setPreferences(customerId, prefs);
  }

  getPreferences(customerId: string): GrowNotificationPreferences {
    return this.notifications.getPreferences(customerId);
  }

  generateReport(input: {
    readonly reportType: GrowReportType;
    readonly customerId: string;
    readonly subjectId: string;
    readonly now: UtcInstant;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
  }): GrowIntelligenceReport {
    const prefs = this.getPreferences(input.customerId);
    const facts = this.factsPort.assembleFacts({
      customerId: input.customerId,
      subjectId: input.subjectId,
      reportingDate: evaluateReportSchedule({
        reportType: input.reportType,
        now: input.now,
        prefs,
      }).reportingDate,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      timeZone: prefs.timeZone,
      now: input.now,
    });

    const structured =
      input.reportType === 'MORNING_BRIEF'
        ? buildStructuredMorningBrief({ facts, now: input.now })
        : buildStructuredEveningRecap({ facts, now: input.now });

    const narrative = summarizeReportSections(input.reportType, structured, this.summarizer);
    const report: GrowIntelligenceReport = Object.freeze({
      reportId: structured.reportId,
      reportType: input.reportType,
      customerId: input.customerId,
      subjectId: input.subjectId,
      reportingDate: facts.reportingDate,
      structured,
      narrativeSections: narrative.sections,
      summary: buildReportSummary(narrative.sections),
      summarizerMode: narrative.summarizerMode,
      summarizerAvailable: narrative.summarizerAvailable,
      factsHash: facts.factsHash,
      generatedAt: input.now,
      serverOwned: true,
    });
    this.store.putReport(report);
    return report;
  }

  maybeGenerateScheduledReport(input: {
    readonly reportType: GrowReportType;
    readonly customerId: string;
    readonly subjectId: string;
    readonly now: UtcInstant;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
  }): GrowIntelligenceReport | null {
    const prefs = this.getPreferences(input.customerId);
    const schedule = evaluateReportSchedule({
      reportType: input.reportType,
      now: input.now,
      prefs,
      alreadyGeneratedForDate: Boolean(
        this.store.findReportForDate({
          customerId: input.customerId,
          reportType: input.reportType,
          reportingDate: evaluateReportSchedule({
            reportType: input.reportType,
            now: input.now,
            prefs,
          }).reportingDate,
        }),
      ),
    });
    if (!schedule.shouldGenerate) {
      return null;
    }
    return this.generateReport(input);
  }

  emitReportNotification(report: GrowIntelligenceReport, now: UtcInstant): GrowNotificationEvent | null {
    const type =
      report.reportType === 'MORNING_BRIEF'
        ? 'GROW_MORNING_BRIEF_AVAILABLE'
        : 'GROW_EVENING_RECAP_AVAILABLE';
    const event = createGrowNotificationEvent({
      type,
      occurredAt: now,
      customerId: report.customerId,
      subjectId: report.subjectId,
      resourceId: report.reportId,
      reportId: report.reportId,
      summary: `${report.reportType} ready for ${report.reportingDate}`,
      userTitle:
        report.reportType === 'MORNING_BRIEF' ? 'Your Morning Grow Brief is ready' : 'Your Evening Grow Recap is ready',
      userBody: report.summary.slice(0, 500),
    });
    const prefs = this.getPreferences(report.customerId);
    const nowMinutes = evaluateReportSchedule({
      reportType: report.reportType,
      now,
      prefs,
    }).nowMinutes;
    const delivery = this.notifications.deliver(event, nowMinutes, now, this.deliveryAdapter);
    if (!delivery) {
      return null;
    }
    this.store.putEvent(event);
    this.store.putDelivery(delivery);
    return event;
  }

  runScheduledCycle(input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly now: UtcInstant;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
  }): {
    readonly morning: GrowIntelligenceReport | null;
    readonly evening: GrowIntelligenceReport | null;
    readonly notifications: readonly GrowNotificationEvent[];
  } {
    const notifications: GrowNotificationEvent[] = [];
    const morning = this.maybeGenerateScheduledReport({
      reportType: 'MORNING_BRIEF',
      ...input,
    });
    if (morning) {
      const event = this.emitReportNotification(morning, input.now);
      if (event) notifications.push(event);
    }
    const evening = this.maybeGenerateScheduledReport({
      reportType: 'EVENING_RECAP',
      ...input,
    });
    if (evening) {
      const event = this.emitReportNotification(evening, input.now);
      if (event) notifications.push(event);
    }
    return Object.freeze({ morning, evening, notifications: Object.freeze(notifications) });
  }

  snapshot() {
    return Object.freeze({
      store: this.store.snapshot(),
      deliveredKeys: this.notifications.snapshotDeliveredKeys(),
    });
  }

  restore(snapshot: ReturnType<GrowIntelligenceService['snapshot']>): void {
    this.store.restore(snapshot.store);
    this.notifications.restoreDeliveredKeys(snapshot.deliveredKeys);
  }
}
