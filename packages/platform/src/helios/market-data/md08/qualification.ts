import {
  HELIOS_MD08_DERIVATIVES_DATA_BLOCKED,
  HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED,
  MD08_DERIVED_IV_LABEL,
} from './taxonomy.ts';
import type { DerivativeMarketState } from './types.ts';

export type Md08QualificationChecks = {
  readonly futuresContractStateComplete: boolean;
  readonly optionsContractStateComplete: boolean;
  readonly settlementAndOpenInterestTyped: boolean;
  readonly observedDerivedMarked: boolean;
  readonly derivedIvNotLabeledExchangeObserved: boolean;
  readonly termStructurePresent: boolean;
  readonly md03RecoverySupported: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Md08QualificationResult = {
  readonly marker: typeof HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED | typeof HELIOS_MD08_DERIVATIVES_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd08DerivativesQualification(
  checks: Md08QualificationChecks,
): Md08QualificationResult {
  const blockers: string[] = [];
  if (!checks.futuresContractStateComplete) blockers.push('futures_contract_state');
  if (!checks.optionsContractStateComplete) blockers.push('options_contract_state');
  if (!checks.settlementAndOpenInterestTyped) blockers.push('settlement_open_interest');
  if (!checks.observedDerivedMarked) blockers.push('observed_derived_provenance');
  if (!checks.derivedIvNotLabeledExchangeObserved) blockers.push('derived_iv_label');
  if (!checks.termStructurePresent) blockers.push('term_structure');
  if (!checks.md03RecoverySupported) blockers.push('md03_recovery');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');
  return Object.freeze({
    marker:
      blockers.length === 0 ? HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED : HELIOS_MD08_DERIVATIVES_DATA_BLOCKED,
    qualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function buildMd08QualificationChecksFromState(
  state: DerivativeMarketState,
  transportOk: boolean,
): Md08QualificationChecks {
  const future = state.futures[0];
  const option = state.options[0];
  const futuresOk = Boolean(
    future &&
      future.book &&
      future.trades.length > 0 &&
      future.settlement &&
      future.openInterest &&
      future.sessionVolume !== null &&
      future.lifecycle.firstNoticeDate !== undefined &&
      future.lifecycle.contractMultiplierMinor > 0n,
  );
  const optionsOk = Boolean(
    option &&
      option.quote.bidMinor !== null &&
      option.quote.askMinor !== null &&
      option.strikeMinor > 0n &&
      option.openInterest &&
      option.underlyingInstrumentId,
  );
  const derivedIvOk = state.options.every(
    (row) =>
      row.derivedImpliedVolatility === null ||
      (row.derivedImpliedVolatility.provenance.kind === 'DERIVED' &&
        row.derivedImpliedVolatility.provenance.notExchangeObserved &&
        row.derivedImpliedVolatility.label === MD08_DERIVED_IV_LABEL),
  );
  const provenanceOk = state.options.every(
    (row) =>
      row.quote.bidProvenance.kind === 'OBSERVED' &&
      (row.exchangeIvProvenance === null || row.exchangeIvProvenance.kind === 'OBSERVED'),
  );
  return Object.freeze({
    futuresContractStateComplete: futuresOk,
    optionsContractStateComplete: optionsOk,
    settlementAndOpenInterestTyped: Boolean(future?.settlement && future?.openInterest),
    observedDerivedMarked: provenanceOk && derivedIvOk,
    derivedIvNotLabeledExchangeObserved: derivedIvOk,
    termStructurePresent: state.termStructures.length > 0 && state.termStructures[0]!.curve.length >= 2,
    md03RecoverySupported: transportOk,
    noExecutionAuthority: !state.grantsExecutionAuthority && state.futures.every((f) => !f.grantsExecutionAuthority),
  });
}
