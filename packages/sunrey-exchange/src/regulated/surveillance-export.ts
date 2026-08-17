import { observeFamilyMarket, type FamilySurveillanceSnapshot } from '../family-surveillance.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CaseManagementPort, RegulatedCaseRecord } from '../../../kernel/src/regulated/case-management.ts';

export const PRODUCTION_SURVEILLANCE_EXPORT_KINDS = [
  'WASH_SELF_TRADING',
  'SPOOF_LIKE',
  'LAYERING_LIKE',
  'MARKET_MANIPULATION_CANDIDATE',
  'CAPACITY_MARKET_ANOMALY',
] as const;
export type ProductionSurveillanceExportKind = (typeof PRODUCTION_SURVEILLANCE_EXPORT_KINDS)[number];

export type SurveillanceExportRecord = {
  readonly kind: ProductionSurveillanceExportKind;
  readonly alertIds: readonly string[];
  readonly legalGuilt: false;
  readonly caseRecord: RegulatedCaseRecord | null;
};

export function exportSurveillanceCases(
  snapshot: FamilySurveillanceSnapshot,
  now: UtcInstant,
  cases: CaseManagementPort,
  subjectRef: string,
): readonly SurveillanceExportRecord[] {
  const alerts = observeFamilyMarket(snapshot, now);
  const exported: SurveillanceExportRecord[] = [];
  const wash = alerts.filter((alert) => alert.kind === 'SELF_TRADING' || alert.kind === 'CIRCULAR_TRADING_CANDIDATE');
  if (wash.length > 0) {
    exported.push(openExport('WASH_SELF_TRADING', wash, cases, subjectRef, snapshot.marketId, now));
  }
  if ((snapshot.deniedAccessCount ?? 0) >= 3) {
    exported.push(
      openExport(
        'MARKET_MANIPULATION_CANDIDATE',
        alerts.filter((alert) => alert.kind === 'REPEATED_DENIED_ACCESS'),
        cases,
        subjectRef,
        snapshot.marketId,
        now,
      ),
    );
  }
  if (
    snapshot.listedCapacity !== undefined &&
    snapshot.deliveredCapacity !== undefined &&
    snapshot.deliveredCapacity > snapshot.listedCapacity
  ) {
    exported.push(
      openExport(
        'CAPACITY_MARKET_ANOMALY',
        alerts.filter((alert) => alert.kind === 'ARTIFICIAL_CAPACITY_CANDIDATE'),
        cases,
        subjectRef,
        snapshot.marketId,
        now,
      ),
    );
  }
  if ((snapshot.nonDeliveryCount ?? 0) >= 3) {
    exported.push(
      openExport(
        'SPOOF_LIKE',
        alerts.filter((alert) => alert.kind.includes('NON_DELIVERY') || alert.kind.includes('MANIPULATION')),
        cases,
        subjectRef,
        snapshot.marketId,
        now,
      ),
    );
    exported.push(
      openExport(
        'LAYERING_LIKE',
        alerts.filter((alert) => alert.kind.includes('MANIPULATION')),
        cases,
        subjectRef,
        snapshot.marketId,
        now,
      ),
    );
  }
  return Object.freeze(exported);
}

function openExport(
  kind: ProductionSurveillanceExportKind,
  alerts: readonly { readonly alertId: string }[],
  cases: CaseManagementPort,
  subjectRef: string,
  marketId: string,
  now: UtcInstant,
): SurveillanceExportRecord {
  const caseRecord = cases.open({
    detectorFactRefs: alerts.map((alert) => alert.alertId),
    customerAccountRefs: [subjectRef],
    priority: 'HIGH',
    subjectRef,
    jurisdiction: 'GB',
    evidenceRefs: [marketId],
    createdAt: now,
  });
  return Object.freeze({
    kind,
    alertIds: Object.freeze(alerts.map((alert) => alert.alertId)),
    legalGuilt: false,
    caseRecord,
  });
}
