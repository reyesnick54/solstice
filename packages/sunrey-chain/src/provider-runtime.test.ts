import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { PROVIDER_DOMAINS } from './providers/types.ts';
import {
  ADAPTER_SUCCESS_IS_NOT_APPROVAL,
  CONSENSUS_HAS_NO_PROVIDER_EGRESS,
  ExecutableBankingAdapter,
  ExecutableHsmAdapter,
  ExecutableKycAdapter,
  ExecutableObjectStorageAdapter,
  ProviderCircuitBreaker,
  PUBLIC_TICKER_POLICY,
  authorizeWorkload,
  bindCredential,
  buildRuntimeReadinessReport,
  collectHealthSnapshots,
  createProviderRuntime,
  day2ProviderOperations,
  decideProviderRetry,
  enrichMatrixWithRuntime,
  evaluateProviderEgress,
  exerciseExecutableAdapters,
  exerciseSupportingAdapters,
  exportRuntimeAudit,
  probePqcCapability,
  resolveRuntimeMode,
  runNegativeControls,
  runProviderIntegrationTests,
  runProviderRuntimeCommand,
  sandboxHarnessUsesMocksWithoutCredentials,
  sealEngineeringEvidence,
  versionedProviderConfig,
} from './provider-runtime/index.ts';
import { createAcceptanceMatrix } from './provider-runtime/harness.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NOW = '2026-08-18T00:00:00.000Z';

describe('Chunk 91 executable provider runtime', () => {
  it('covers every canonical provider domain against local mocks', () => {
    const runtime = createProviderRuntime();
    assert.equal(runtime.ok, true);
    if (!runtime.ok) {
      return;
    }
    assert.equal(runtime.value.reportedMode, 'LOCAL_SIMULATION');
    const tests = runProviderIntegrationTests(runtime.value);
    assert.equal(tests.length, PROVIDER_DOMAINS.length);
    assert.equal(tests.every((row) => row.passed && row.engineeringOnly && row.legallyApproved === false), true);
    assert.equal(sandboxHarnessUsesMocksWithoutCredentials(runtime.value), true);
  });

  it('refuses PRODUCTION_AUTHORIZED without evidence and human authority', () => {
    const refused = resolveRuntimeMode({
      requested: 'PRODUCTION_AUTHORIZED',
      sandboxCredentialPresent: false,
      externalEvidencePresent: false,
      humanAuthorityPresent: false,
    });
    assert.equal(refused.ok, false);
    const authorized = resolveRuntimeMode({
      requested: 'PRODUCTION_AUTHORIZED',
      sandboxCredentialPresent: true,
      externalEvidencePresent: true,
      humanAuthorityPresent: true,
    });
    assert.equal(authorized.ok, true);
  });

  it('enforces least privilege and consensus isolation', () => {
    assert.equal(authorizeWorkload('oracle_collector', 'HSM').ok, false);
    assert.equal(authorizeWorkload('explorer', 'IDENTITY_KYC').ok, false);
    assert.equal(authorizeWorkload('rpc', 'KMS').ok, false);
    assert.equal(authorizeWorkload('case_management', 'HSM').ok, false);
    assert.equal(authorizeWorkload('consensus_execution', 'ORACLE_DATA_SOURCE').ok, false);
    assert.equal(CONSENSUS_HAS_NO_PROVIDER_EGRESS, true);
    assert.equal(evaluateProviderEgress('consensus_execution').allowed, false);
    const wrong = bindCredential({
      bindingId: 'b1',
      providerId: 'kyc',
      domain: 'IDENTITY_KYC',
      credentialHref: 'secret://local/kyc-worker',
      workloadIdentity: 'explorer',
    });
    assert.equal(wrong.ok, false);
  });

  it('records mandatory negative controls', () => {
    const runtime = createProviderRuntime();
    assert.equal(runtime.ok, true);
    if (!runtime.ok) {
      return;
    }
    const negatives = runNegativeControls(runtime.value);
    assert.equal(negatives.secretValueExcluded, true);
    assert.equal(negatives.wrongWorkloadRejected, true);
    assert.equal(negatives.oracleCannotAccessHsm, true);
    assert.equal(negatives.explorerCannotAccessKyc, true);
    assert.equal(negatives.kycCannotIssueAuthority, true);
    assert.equal(negatives.bankCannotCreateLedger, true);
    assert.equal(negatives.duplicateFinancialProtected, true);
    assert.equal(negatives.replayedWebhookRejected, true);
    assert.equal(negatives.wrongSignatureRejected, true);
    assert.equal(negatives.schemaChangeDetected, true);
    assert.equal(negatives.softwarePqCannotClaimHardware, true);
    assert.equal(negatives.sandboxCannotMarkLegal, true);
    assert.equal(negatives.aiProviderApprovalRejected, true);
  });

  it('executes KMS, HSM, storage, oracle, KYC, custody and banking adapters', () => {
    const runtime = createProviderRuntime();
    assert.equal(runtime.ok, true);
    if (!runtime.ok) {
      return;
    }
    const adapters = exerciseExecutableAdapters(runtime.value);
    assert.deepEqual(adapters.cloud, [
      'cloud.aws',
      'cloud.azure',
      'cloud.google_cloud',
      'cloud.kubernetes',
      'cloud.vault_openbao',
    ]);
    assert.equal(adapters.kmsExportBlocked, true);
    assert.equal(adapters.hsmExportBlocked, true);
    assert.equal(adapters.pqc.hardwarePq, 'UNKNOWN');
    assert.equal(adapters.pqc.inferredHardware, false);
    assert.equal(adapters.oracle, true);
    assert.equal(adapters.custodyIdempotent, true);
    assert.equal(new ExecutableBankingAdapter(runtime.value.transport).createLedgerBalance().ok, false);
    assert.equal(ADAPTER_SUCCESS_IS_NOT_APPROVAL, true);
    const supporting = exerciseSupportingAdapters(runtime.value);
    assert.equal(Object.values(supporting).every(Boolean), true);
    const storage = new ExecutableObjectStorageAdapter(runtime.value.transport);
    const put = storage.put('obj', 'bytes');
    assert.equal(put.ok, true);
    const hsm = new ExecutableHsmAdapter(runtime.value.transport);
    assert.equal(hsm.exportPrivateKey().ok, false);
    const kyc = new ExecutableKycAdapter(runtime.value.transport);
    assert.equal(kyc.adapterId, 'kyc.runtime');
  });

  it('never infers hardware PQ from software support', () => {
    const probe = probePqcCapability({
      providerId: 'sim',
      classicalSupported: true,
      mlDsaSupported: true,
      hybridSupported: true,
      hardwarePqEvidence: false,
    });
    assert.equal(probe.mlDsa, 'ML_DSA_SUPPORTED');
    assert.equal(probe.hardwarePq, 'UNKNOWN');
    assert.equal(probe.softwarePqCannotClaimHardware, true);
  });

  it('protects financial retries and circuit states', () => {
    const unknown = decideProviderRetry({
      attempt: 1,
      financial: true,
      lastState: 'SUBMISSION_UNKNOWN',
      transient: true,
    });
    assert.equal(unknown.retry, false);
    const breaker = new ProviderCircuitBreaker(2);
    assert.equal(breaker.record('DEGRADED'), 'DEGRADED');
    assert.equal(breaker.record('RATE_LIMITED'), 'RATE_LIMITED');
    assert.equal(breaker.record('SCHEMA_INCOMPATIBLE'), 'SCHEMA_INCOMPATIBLE');
  });

  it('seals engineering evidence and preserves matrix lanes', () => {
    const runtime = createProviderRuntime();
    assert.equal(runtime.ok, true);
    if (!runtime.ok) {
      return;
    }
    const tests = runProviderIntegrationTests(runtime.value);
    const evidence = sealEngineeringEvidence(tests[0]!, NOW);
    assert.equal(evidence.kind, 'ENGINEERING_INTEGRATION');
    assert.equal(evidence.legalApproval, false);
    assert.equal(evidence.commercialApproval, false);
    const snapshots = collectHealthSnapshots(runtime.value, NOW);
    const enriched = enrichMatrixWithRuntime(createAcceptanceMatrix(), tests, snapshots);
    assert.equal(enriched.lanesPreserved, true);
    assert.equal(enriched.liveRuntime.every((row) => row.legallyApproved === false), true);
    const report = buildRuntimeReadinessReport(runtime.value, NOW);
    assert.equal(report.secretValuePresent, false);
    assert.equal(report.reportedMode, 'LOCAL_SIMULATION');
    const audit = exportRuntimeAudit(NOW);
    assert.equal(audit.kind, 'provider-runtime');
    const day2 = day2ProviderOperations(NOW);
    assert.equal(day2.evidenceExpirationReflected, true);
    assert.equal(versionedProviderConfig().credentialsInGit, false);
    assert.equal(PUBLIC_TICKER_POLICY, 'NOT_ASSIGNED');
  });

  it('exposes sunrey-ops provider runtime-test with an explicit mode', () => {
    const result = runProviderRuntimeCommand(['runtime-test']);
    assert.equal(result.ok, true);
    const payload = result.payload as { readonly reportedMode: string; readonly secretValuePresent: boolean };
    assert.equal(payload.reportedMode, 'LOCAL_SIMULATION');
    assert.equal(payload.secretValuePresent, false);
    const ops = runProviderRuntimeCommand(['runtime-test']);
    assert.equal(ops.ok, true);
    assert.equal((ops.payload as { reportedMode: string }).reportedMode, 'LOCAL_SIMULATION');
  });

  it('does not create a competing provider package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/provider-runtime/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/provider-runtime')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-provider-runtime')), false);
    assert.equal(existsSync(join(ROOT, 'packages/executable-providers')), false);
    assert.equal(existsSync(join(ROOT, 'packages/provider-adapters')), false);
    assert.equal(existsSync(join(ROOT, 'docs/providers/chunk-91-provider-runtime.md')), true);
  });
});
