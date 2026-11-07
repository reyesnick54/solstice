/**
 * HELIOS EXEC08 — broker account, custody, and asset-segregation connectivity.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSET_AVAILABILITY_STATES,
  EXTERNAL_ACCOUNT_REPRESENTATION_MODELS,
  EXEC08_RECORD_TRUTH,
  HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED,
  defaultExec08QualificationChecksPass,
  evaluateExec08AssetSegregationQualification,
} from '../packages/custody/src/execution-connectivity/index.ts';
import type {
  ExternalBrokerAccount,
  ExternalCashPosition,
  ExternalSecurityPosition,
} from '../packages/investments/src/execution-connectivity/index.ts';
import { join } from 'node:path';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('HELIOS EXEC08 asset segregation qualification', () => {
  it('exposes canonical account and availability taxonomies', () => {
    assert.deepEqual([...EXTERNAL_ACCOUNT_REPRESENTATION_MODELS], [
      'FULLY_DISCLOSED',
      'OMNIBUS',
      'SEGREGATED',
      'INSTITUTIONAL',
      'UNKNOWN',
    ]);
    assert.deepEqual([...ASSET_AVAILABILITY_STATES], [
      'AVAILABLE',
      'HELD',
      'UNSETTLED',
      'SETTLED',
      'PENDING_TRANSFER',
    ]);
  });

  it('enforces independent provider vs ledger truth', () => {
    assert.equal(EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth, false);
    assert.equal(EXEC08_RECORD_TRUTH.sunReyLedgerIsProviderCustodyTruth, false);
    assert.equal(EXEC08_RECORD_TRUTH.silentBalanceSynchronization, false);
    assert.equal(EXEC08_RECORD_TRUTH.independentRecordsMustReconcile, true);
  });

  it('exports required EXEC08 record types from investments and custody owners', () => {
    const broker: ExternalBrokerAccount['schema'] = 'sunrey.external-broker-account.v1';
    const cash: ExternalCashPosition['simulation'] = true;
    const security: ExternalSecurityPosition['providerBalanceIsLedgerTruth'] = false;
    assert.equal(broker, 'sunrey.external-broker-account.v1');
    assert.equal(cash, true);
    assert.equal(security, false);
  });

  it('qualifies HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED', () => {
    const result = evaluateExec08AssetSegregationQualification(defaultExec08QualificationChecksPass());
    assert.equal(result.marker, HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('passes HELIOS boundary lint for the repository', () => {
    const issues = lintHeliosBoundary(REPO_ROOT);
    const exec08 = issues.filter((i) => i.file.includes('execution-connectivity'));
    assert.equal(exec08.length, 0, exec08.map((i) => i.message).join('; '));
  });
});
