export const HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED = 'HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED' as const;

export const HELIOS_EXEC02_BROKER_PROTOCOL_BLOCKED = 'HELIOS_EXEC02_BROKER_PROTOCOL_BLOCKED' as const;

export type Exec02QualificationChecks = {
  readonly allCommandTypesDeclared: boolean;
  readonly allOrderStatesDeclared: boolean;
  readonly eventPurposeDistinctFromOrderState: boolean;
  readonly identifiersPresent: boolean;
  readonly orderChainImmutable: boolean;
  readonly fixAdapterVersionAgnostic: boolean;
  readonly restWsAdapterAligned: boolean;
  readonly noExecutionAuthority: boolean;
  readonly simulationPosture: boolean;
  readonly extendsCanonicalOwners: boolean;
};

export type Exec02QualificationResult = {
  readonly marker: typeof HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED | typeof HELIOS_EXEC02_BROKER_PROTOCOL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateExec02Qualification(checks: Exec02QualificationChecks): Exec02QualificationResult {
  const blockers: string[] = [];
  if (!checks.allCommandTypesDeclared) blockers.push('command_types');
  if (!checks.allOrderStatesDeclared) blockers.push('order_states');
  if (!checks.eventPurposeDistinctFromOrderState) blockers.push('event_purpose_vs_order_state');
  if (!checks.identifiersPresent) blockers.push('identifiers');
  if (!checks.orderChainImmutable) blockers.push('order_chain');
  if (!checks.fixAdapterVersionAgnostic) blockers.push('fix_adapter');
  if (!checks.restWsAdapterAligned) blockers.push('rest_ws_adapter');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');
  if (!checks.simulationPosture) blockers.push('simulation_posture');
  if (!checks.extendsCanonicalOwners) blockers.push('canonical_owners');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED : HELIOS_EXEC02_BROKER_PROTOCOL_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
