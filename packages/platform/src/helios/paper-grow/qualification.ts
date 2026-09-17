/**
 * HELIOS H15 qualification gate.
 * Emits HELIOS_PAPER_GROW_LOOP_QUALIFIED only when all acceptance conditions pass.
 */

export const HELIOS_PAPER_GROW_LOOP_QUALIFIED = 'HELIOS_PAPER_GROW_LOOP_QUALIFIED' as const;
export const HELIOS_PAPER_GROW_LOOP_BLOCKED = 'HELIOS_PAPER_GROW_LOOP_BLOCKED' as const;

export type PaperGrowQualificationResult = {
  readonly marker: typeof HELIOS_PAPER_GROW_LOOP_QUALIFIED | typeof HELIOS_PAPER_GROW_LOOP_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export type PaperGrowQualificationChecks = {
  readonly overviewReturnsServerOwnedState: boolean;
  readonly activityExposesPaperCycle: boolean;
  readonly resultsSeparatePaperFromLive: boolean;
  readonly cashDistinguishesReservedDeployed: boolean;
  readonly restartPreservesState: boolean;
  readonly noDuplicateExecutionOnRestart: boolean;
  readonly customerIsolationHolds: boolean;
  readonly crashBoundaryResearchSurvives: boolean;
  readonly crashBoundaryProposalSurvives: boolean;
  readonly crashBoundarySubmissionSurvives: boolean;
  readonly crashBoundaryFillSurvives: boolean;
  readonly crashBoundaryPositionSurvives: boolean;
  readonly disclosureMachineReadable: boolean;
};

export function evaluatePaperGrowQualification(checks: PaperGrowQualificationChecks): PaperGrowQualificationResult {
  const blockers: string[] = [];
  if (!checks.overviewReturnsServerOwnedState) blockers.push('overview not server-owned');
  if (!checks.activityExposesPaperCycle) blockers.push('activity missing paper cycle');
  if (!checks.resultsSeparatePaperFromLive) blockers.push('paper/live not separated');
  if (!checks.cashDistinguishesReservedDeployed) blockers.push('cash buckets not distinguished');
  if (!checks.restartPreservesState) blockers.push('restart state mismatch');
  if (!checks.noDuplicateExecutionOnRestart) blockers.push('duplicate execution on restart');
  if (!checks.customerIsolationHolds) blockers.push('customer isolation failure');
  if (!checks.crashBoundaryResearchSurvives) blockers.push('crash after research failed');
  if (!checks.crashBoundaryProposalSurvives) blockers.push('crash after proposal failed');
  if (!checks.crashBoundarySubmissionSurvives) blockers.push('crash after submission failed');
  if (!checks.crashBoundaryFillSurvives) blockers.push('crash after fill failed');
  if (!checks.crashBoundaryPositionSurvives) blockers.push('crash after position update failed');
  if (!checks.disclosureMachineReadable) blockers.push('disclosure not machine-readable');
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_PAPER_GROW_LOOP_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_PAPER_GROW_LOOP_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
