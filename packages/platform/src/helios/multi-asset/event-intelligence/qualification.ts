/**
 * HELIOS Multi-Asset M14 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED =
  'HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_BLOCKED =
  'HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_BLOCKED' as const;

export type MacroEventIntelligenceQualificationChecks = {
  readonly scheduledCpiRelease: boolean;
  readonly centralBankEvent: boolean;
  readonly oilInventoryEvent: boolean;
  readonly opecEvent: boolean;
  readonly actualVsConsensus: boolean;
  readonly missingActualHandled: boolean;
  readonly conflictingSourcesDetected: boolean;
  readonly lateArrivingInformation: boolean;
  readonly staleEventExcluded: boolean;
  readonly provenancePreserved: boolean;
  readonly inferenceSeparation: boolean;
  readonly eventExpiration: boolean;
  readonly upcomingEventQuery: boolean;
  readonly persistenceRestart: boolean;
  readonly noExecutionAuthority: boolean;
};

export type MacroEventIntelligenceQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMacroEventIntelligenceQualification(
  checks: MacroEventIntelligenceQualificationChecks,
): MacroEventIntelligenceQualificationResult {
  const blockers: string[] = [];
  if (!checks.scheduledCpiRelease) blockers.push('scheduled_cpi_release');
  if (!checks.centralBankEvent) blockers.push('central_bank_event');
  if (!checks.oilInventoryEvent) blockers.push('oil_inventory_event');
  if (!checks.opecEvent) blockers.push('opec_event');
  if (!checks.actualVsConsensus) blockers.push('actual_vs_consensus');
  if (!checks.missingActualHandled) blockers.push('missing_actual');
  if (!checks.conflictingSourcesDetected) blockers.push('conflicting_sources');
  if (!checks.lateArrivingInformation) blockers.push('late_arriving_information');
  if (!checks.staleEventExcluded) blockers.push('stale_event');
  if (!checks.provenancePreserved) blockers.push('provenance');
  if (!checks.inferenceSeparation) blockers.push('inference_separation');
  if (!checks.eventExpiration) blockers.push('event_expiration');
  if (!checks.upcomingEventQuery) blockers.push('upcoming_event_query');
  if (!checks.persistenceRestart) blockers.push('persistence_restart');
  if (!checks.noExecutionAuthority) blockers.push('no_execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED
      : HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
