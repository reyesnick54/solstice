import type {
  GrowIntelligenceReport,
  GrowIntelligenceStoreSnapshot,
  GrowNotificationDeliveryRecord,
  GrowNotificationEvent,
  GrowNotificationPreferences,
} from './types.ts';

export class InMemoryGrowIntelligenceStore {
  private readonly reports = new Map<string, GrowIntelligenceReport>();
  private readonly events: GrowNotificationEvent[] = [];
  private readonly deliveries: GrowNotificationDeliveryRecord[] = [];
  private readonly preferences = new Map<string, GrowNotificationPreferences>();

  putReport(report: GrowIntelligenceReport): void {
    this.reports.set(report.reportId, report);
  }

  getReport(reportId: string): GrowIntelligenceReport | undefined {
    return this.reports.get(reportId);
  }

  listReports(customerId: string): readonly GrowIntelligenceReport[] {
    return Object.freeze([...this.reports.values()].filter((row) => row.customerId === customerId));
  }

  findReportForDate(input: {
    readonly customerId: string;
    readonly reportType: GrowIntelligenceReport['reportType'];
    readonly reportingDate: string;
  }): GrowIntelligenceReport | undefined {
    return [...this.reports.values()].find(
      (row) =>
        row.customerId === input.customerId &&
        row.reportType === input.reportType &&
        row.reportingDate === input.reportingDate,
    );
  }

  putEvent(event: GrowNotificationEvent): void {
    this.events.push(event);
  }

  listEvents(customerId?: string): readonly GrowNotificationEvent[] {
    if (!customerId) {
      return Object.freeze([...this.events]);
    }
    return Object.freeze(this.events.filter((row) => row.customerId === customerId));
  }

  putDelivery(delivery: GrowNotificationDeliveryRecord): void {
    this.deliveries.push(delivery);
  }

  listDeliveries(customerId?: string): readonly GrowNotificationDeliveryRecord[] {
    if (!customerId) {
      return Object.freeze([...this.deliveries]);
    }
    return Object.freeze(this.deliveries.filter((row) => row.customerId === customerId));
  }

  setPreferences(customerId: string, prefs: GrowNotificationPreferences): void {
    this.preferences.set(customerId, Object.freeze({ ...prefs }));
  }

  getPreferences(customerId: string): GrowNotificationPreferences | undefined {
    return this.preferences.get(customerId);
  }

  snapshot(): GrowIntelligenceStoreSnapshot {
    return Object.freeze({
      reports: Object.freeze([...this.reports.values()]),
      events: Object.freeze([...this.events]),
      deliveries: Object.freeze([...this.deliveries]),
      preferences: Object.freeze(Object.fromEntries(this.preferences.entries())),
      deliveredKeys: Object.freeze(
        this.deliveries.map((row) => row.deduplicationKey),
      ),
    });
  }

  restore(snapshot: GrowIntelligenceStoreSnapshot): void {
    this.reports.clear();
    this.events.length = 0;
    this.deliveries.length = 0;
    this.preferences.clear();
    for (const report of snapshot.reports) {
      this.reports.set(report.reportId, report);
    }
    this.events.push(...snapshot.events);
    this.deliveries.push(...snapshot.deliveries);
    for (const [customerId, prefs] of Object.entries(snapshot.preferences)) {
      this.preferences.set(customerId, prefs);
    }
  }
}
