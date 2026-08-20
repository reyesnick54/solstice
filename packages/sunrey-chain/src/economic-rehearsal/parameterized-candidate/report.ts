/**
 * Build ParameterizedDualEconomyRehearsalReport.
 */

import { ENVIRONMENT } from '../../../../config/src/flags.ts';
import type { ParameterizedDualEconomyRehearsalReport } from '../types.ts';
import {
  PARAMETER_CLASS,
  PARAMETERIZED_REHEARSAL_SCHEMA_VERSION,
  PARAMETERIZED_REHEARSAL_TOOL_VERSION,
} from './types.ts';

export function buildParameterizedDualEconomyRehearsalReport(
  report: Omit<
    ParameterizedDualEconomyRehearsalReport,
    | 'schemaVersion'
    | 'toolVersion'
    | 'parameterClass'
    | 'productionAuthorized'
    | 'fixtureParameters'
    | 'liveFlagsChanged'
    | 'environment'
    | 'productionActive'
    | 'exchangePriceControlsIssuance'
    | 'peveUsedAsSunReyFormula'
    | 'gpuvEqualsMoonRey'
    | 'fixtureCanAuthorizeProduction'
  >,
): ParameterizedDualEconomyRehearsalReport {
  return Object.freeze({
    schemaVersion: PARAMETERIZED_REHEARSAL_SCHEMA_VERSION,
    toolVersion: PARAMETERIZED_REHEARSAL_TOOL_VERSION,
    parameterClass: PARAMETER_CLASS,
    productionAuthorized: false,
    fixtureParameters: true,
    liveFlagsChanged: false,
    environment: ENVIRONMENT,
    productionActive: false,
    exchangePriceControlsIssuance: false,
    peveUsedAsSunReyFormula: false,
    gpuvEqualsMoonRey: false,
    fixtureCanAuthorizeProduction: false,
    ...report,
  });
}

export function demoLines(report: ParameterizedDualEconomyRehearsalReport): readonly string[] {
  return Object.freeze([
    `PARAMETER_CLASS=${report.parameterClass}`,
    'PRODUCTION_PARAMETER_RECOMMENDATION=false',
    `SUNREY_PATH_COMPLETE=${report.sunreyPathComplete}`,
    `MOONREY_V2_PATH_COMPLETE=${report.moonreyV2PathComplete}`,
    `SUPPLIES_RECONCILED=${report.suppliesReconciled}`,
    'FIXTURE_CAN_AUTHORIZE_PRODUCTION=false',
    'EXCHANGE_PRICE_CONTROLS_ISSUANCE=false',
    'PEVE_USED_AS_SUNREY_FORMULA=false',
    'GPUV_EQUALS_MOONREY=false',
    'LIVE_FLAGS_CHANGED=false',
    'PRODUCTION_ACTIVE=false',
  ]);
}
