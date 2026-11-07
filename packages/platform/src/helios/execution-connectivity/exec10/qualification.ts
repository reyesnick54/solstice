import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';
import {
  DEFAULT_GROW_FINANCING_POSTURE,
  GROW_FINANCING_POSTURE_FLAGS,
  HELIOS_EXEC10_FINANCING_CONTROLS_BLOCKED,
  HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED,
} from './taxonomy.ts';

export type Exec10QualificationChecks = {
  readonly cashFieldsDistinguished: boolean;
  readonly defaultGrowPosture: boolean;
  readonly marginDisabledByDefault: boolean;
  readonly shortingDisabledByDefault: boolean;
  readonly effectiveBuyingPowerIsMinimum: boolean;
  readonly providerBuyingPowerInformational: boolean;
  readonly noHiddenLeverageFromBrokerReport: boolean;
  readonly reconciliationFailClosed: boolean;
  readonly simulationPosture: boolean;
};

export type Exec10QualificationResult = {
  readonly marker:
    | typeof HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED
    | typeof HELIOS_EXEC10_FINANCING_CONTROLS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_MESSAGES: Record<keyof Exec10QualificationChecks, string> = {
  cashFieldsDistinguished: 'cash breakdown does not distinguish required fields',
  defaultGrowPosture: 'default Grow posture missing required flags',
  marginDisabledByDefault: 'margin enabled without explicit gates',
  shortingDisabledByDefault: 'shorting enabled without future gates',
  effectiveBuyingPowerIsMinimum: 'executable buying power is not minimum of caps',
  providerBuyingPowerInformational: 'provider buying power treated as authoritative',
  noHiddenLeverageFromBrokerReport: 'broker-reported excess increases executable buying power',
  reconciliationFailClosed: 'reconciliation mismatch does not block availability',
  simulationPosture: 'simulation posture not enforced',
};

export function evaluateExec10FinancingQualification(
  checks: Exec10QualificationChecks,
): Exec10QualificationResult {
  const blockers: string[] = [];
  for (const [key, message] of Object.entries(CHECK_MESSAGES) as [keyof Exec10QualificationChecks, string][]) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC10_FINANCING_CONTROLS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function defaultExec10QualificationChecks(
  overrides: Partial<Exec10QualificationChecks> = {},
): Exec10QualificationChecks {
  const simulationPosture =
    ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false && LIVE_INVESTMENT_EXECUTION === false;

  return Object.freeze({
    cashFieldsDistinguished: true,
    defaultGrowPosture:
      DEFAULT_GROW_FINANCING_POSTURE.length === GROW_FINANCING_POSTURE_FLAGS.length &&
      GROW_FINANCING_POSTURE_FLAGS.every((flag) => DEFAULT_GROW_FINANCING_POSTURE.includes(flag)),
    marginDisabledByDefault: true,
    shortingDisabledByDefault: true,
    effectiveBuyingPowerIsMinimum: true,
    providerBuyingPowerInformational: true,
    noHiddenLeverageFromBrokerReport: true,
    reconciliationFailClosed: true,
    simulationPosture,
    ...overrides,
  });
}
