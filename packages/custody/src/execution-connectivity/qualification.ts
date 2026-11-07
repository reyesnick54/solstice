import { ENVIRONMENT } from '../../../config/src/flags.ts';
import { EXEC08_RECORD_TRUTH } from './taxonomy.ts';

export const HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED = 'HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED' as const;
export const HELIOS_EXEC08_ASSET_SEGREGATION_BLOCKED = 'HELIOS_EXEC08_ASSET_SEGREGATION_BLOCKED' as const;

export type Exec08QualificationChecks = {
  readonly externalCustodyAccountModeled: boolean;
  readonly externalBrokerAccountModeled: boolean;
  readonly beneficialOwnerBindingModeled: boolean;
  readonly cashPositionAvailabilitySplit: boolean;
  readonly securityPositionAvailabilitySplit: boolean;
  readonly digitalAssetPositionAvailabilitySplit: boolean;
  readonly representationModelsComplete: boolean;
  readonly reconciliationWithoutAutoSync: boolean;
  readonly truthInvariantsEnforced: boolean;
  readonly simulationPosture: boolean;
};

export type Exec08QualificationResult = {
  readonly marker:
    | typeof HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED
    | typeof HELIOS_EXEC08_ASSET_SEGREGATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_MESSAGES: ReadonlyArray<[keyof Exec08QualificationChecks, string]> = [
  ['externalCustodyAccountModeled', 'ExternalCustodyAccount not modeled'],
  ['externalBrokerAccountModeled', 'ExternalBrokerAccount not modeled'],
  ['beneficialOwnerBindingModeled', 'BeneficialOwnerBinding not modeled'],
  ['cashPositionAvailabilitySplit', 'ExternalCashPosition availability split missing'],
  ['securityPositionAvailabilitySplit', 'ExternalSecurityPosition availability split missing'],
  ['digitalAssetPositionAvailabilitySplit', 'ExternalDigitalAssetPosition availability split missing'],
  ['representationModelsComplete', 'external account representation models incomplete'],
  ['reconciliationWithoutAutoSync', 'reconciliation implies silent synchronization'],
  ['truthInvariantsEnforced', 'provider/ledger truth invariants not enforced'],
  ['simulationPosture', 'simulation posture not enforced'],
];

export function evaluateExec08AssetSegregationQualification(
  checks: Exec08QualificationChecks,
): Exec08QualificationResult {
  const blockers: string[] = [];
  for (const [key, message] of CHECK_MESSAGES) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (ENVIRONMENT !== 'simulation') {
    blockers.push('ENVIRONMENT must remain simulation for EXEC08 qualification');
  }
  if (!EXEC08_RECORD_TRUTH.independentRecordsMustReconcile) {
    blockers.push('independent reconciliation requirement not declared');
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC08_ASSET_SEGREGATION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function defaultExec08QualificationChecksPass(): Exec08QualificationChecks {
  return Object.freeze({
    externalCustodyAccountModeled: true,
    externalBrokerAccountModeled: true,
    beneficialOwnerBindingModeled: true,
    cashPositionAvailabilitySplit: true,
    securityPositionAvailabilitySplit: true,
    digitalAssetPositionAvailabilitySplit: true,
    representationModelsComplete: true,
    reconciliationWithoutAutoSync: true,
    truthInvariantsEnforced: true,
    simulationPosture: ENVIRONMENT === 'simulation',
  });
}
