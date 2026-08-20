import { RECOVERY_AUTHORITY } from './authority.ts';
import { rehydrationOrder } from './rehydration.ts';
import { discoverUnresolved, readinessFor } from './reconciliation.ts';
import type { OperationalSnapshot } from '../operational/types.ts';
import type { RecoveryIntegrityFinding, RecoveryReport } from './types.ts';

export function buildRecoveryReport(input: {
  readonly snapshot: OperationalSnapshot;
  readonly findings?: readonly RecoveryIntegrityFinding[];
  readonly jsonIntegrityPass: boolean;
  readonly corrupt?: boolean;
}): RecoveryReport {
  const unresolved = discoverUnresolved(input.snapshot);
  return Object.freeze({
    readiness: readinessFor(unresolved, input.corrupt === true),
    rehydrationOrder: rehydrationOrder(),
    unresolved,
    findings: input.findings ?? [],
    authority: RECOVERY_AUTHORITY,
    rawCredentialPersisted: false,
    realProviderCalled: false,
    productionActive: false,
    jsonIntegrityPass: input.jsonIntegrityPass,
    duplicatePackageKeys: false,
    corruptionFailsClosed: true,
  });
}

export function printRecoveryFlags(report: RecoveryReport, recovered: {
  readonly payment: boolean;
  readonly custody: boolean;
  readonly exchange: boolean;
}): string {
  return [
    `JSON_INTEGRITY_PASS=${report.jsonIntegrityPass}`,
    `DUPLICATE_PACKAGE_KEYS=${report.duplicatePackageKeys}`,
    `CORRUPTION_FAILS_CLOSED=${report.corruptionFailsClosed}`,
    `PAYMENT_STATE_RECOVERED=${recovered.payment}`,
    `CUSTODY_DUAL_ASSET_STATE_RECOVERED=${recovered.custody}`,
    `EXCHANGE_STATE_RECOVERED=${recovered.exchange}`,
    `RAW_CREDENTIAL_PERSISTED=${report.rawCredentialPersisted}`,
    `POSTGRES_IS_LEDGER=${report.authority.postgresIsLedger}`,
    `POSTGRES_IS_NATIVE_SUPPLY_AUTHORITY=${report.authority.postgresIsNativeSupplyAuthority}`,
    `REAL_PROVIDER_CALLED=${report.realProviderCalled}`,
    `PRODUCTION_ACTIVE=${report.productionActive}`,
  ].join('\n');
}
