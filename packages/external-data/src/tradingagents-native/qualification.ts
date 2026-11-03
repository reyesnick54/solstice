export const HELIOS_NATIVE_TRADINGAGENTS_DATAFLOW_PORTED =
  'HELIOS_NATIVE_TRADINGAGENTS_DATAFLOW_PORTED' as const;

export type Native10DataflowChecks = {
  readonly dateWindowDiscipline: boolean;
  readonly symbolNormalization: boolean;
  readonly providerFallback: boolean;
  readonly macroRouting: boolean;
  readonly pitSecEdgar: boolean;
  readonly noPythonProductionDependency: boolean;
};

export function evaluateNative10DataflowChecks(checks: Native10DataflowChecks): {
  readonly pass: boolean;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  if (!checks.dateWindowDiscipline) blockers.push('date_window_discipline');
  if (!checks.symbolNormalization) blockers.push('symbol_normalization');
  if (!checks.providerFallback) blockers.push('provider_fallback');
  if (!checks.macroRouting) blockers.push('macro_routing');
  if (!checks.pitSecEdgar) blockers.push('pit_sec_edgar');
  if (!checks.noPythonProductionDependency) blockers.push('no_python_production_dependency');
  return Object.freeze({ pass: blockers.length === 0, blockers: Object.freeze(blockers) });
}
