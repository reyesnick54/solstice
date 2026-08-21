import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { asBeneficiaryId, asPaymentId } from '../../ids.ts';
import { simulationCapabilities } from '../../rail-capability.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from '../../rail-submission.ts';
import type { AuthorizedRailCommand } from '../../rail-port.ts';
import { SimulatedProductionRailAdapter } from '../rails/simulated.ts';
import { normalizePaymentProviderStatus } from '../rails/status.ts';
import { classifySubmissionCertainty, decidePaymentResubmission } from '../rails/idempotency.ts';
import { FinancialWebhookIngestor } from '../webhooks/ingest.ts';
import { WEBHOOK_SCHEMA_VERSION } from '../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import { incompleteWithoutReconciliation } from '../reconciliation/contract.ts';
import { SimulatedFinancialReconciliationAdapter } from '../reconciliation/simulated.ts';
import { caseResult, suiteResult, type CertificationSuiteResult } from './harness.ts';

const NOW = asUtcInstant('2026-08-21T00:00:00.000Z');

export function runPaymentCertificationSuite(): CertificationSuiteResult {
  const capability = simulationCapabilities().find((row) => row.rail === 'US_BATCH');
  if (!capability) {
    return suiteResult('PAYMENT', [caseResult('capability', false, 'US_BATCH missing')]);
  }
  const adapter = new SimulatedProductionRailAdapter(capability, 'ACH');
  const cases = [];

  const submit = (paymentId: string) => {
    const id = asPaymentId(paymentId);
    const submission = createRailSubmission(
      {
        paymentId: id,
        provider: capability.provider,
        rail: capability.rail,
        amount: Money.fromMinorUnits(1000n, 'USD'),
        currency: 'USD' as never,
        sourceReference: 'src_opaque',
        destinationReference: 'dst_opaque',
        beneficiaryReference: asBeneficiaryId('ben_cert'),
        purposeReference: 'certification',
        idempotencyKey: providerIdempotencyKeyFor(paymentId, `key_${paymentId}`),
        correlationId: `corr_${paymentId}`,
        requestedSettlement: { settlementClass: 'BATCH', requestedAt: null },
      },
      NOW,
    );
    const command: AuthorizedRailCommand = {
      authorityId: 'ea_cert_not_issued_by_adapter',
      actionType: 'INITIATE_PAYMENT',
      submission,
    };
    return { id, command, result: adapter.submitPayment(command) };
  };

  const submitted = submit('pay_cert_ach');
  cases.push(caseResult('submission', ['SETTLED', 'PENDING', 'ACCEPTED'].includes(submitted.result.status), submitted.result.status));
  const duplicate = adapter.submitPayment(submitted.command);
  cases.push(
    caseResult(
      'idempotency',
      duplicate.status === submitted.result.status &&
        duplicate.references.providerPaymentId === submitted.result.references.providerPaymentId,
      duplicate.status,
    ),
  );
  const status = adapter.queryPayment({
    paymentId: submitted.id,
    idempotencyKey: submitted.command.submission.idempotencyKey,
    providerPaymentId: submitted.result.references.providerPaymentId,
  });
  cases.push(caseResult('status', status.found, status.providerStatus));

  adapter.setMode(asPaymentId('pay_cert_pending'), 'PENDING');
  cases.push(caseResult('pending', submit('pay_cert_pending').result.status === 'PENDING', 'PENDING'));
  adapter.setMode(asPaymentId('pay_cert_reject'), 'REJECT');
  cases.push(caseResult('rejection', submit('pay_cert_reject').result.status === 'REJECTED', 'REJECTED'));
  adapter.setMode(asPaymentId('pay_cert_return'), 'RETURNED');
  cases.push(caseResult('return', submit('pay_cert_return').result.status === 'RETURNED', 'RETURNED'));
  adapter.setMode(asPaymentId('pay_cert_timeout'), 'TIMEOUT_AFTER_UNKNOWN');
  cases.push(caseResult('timeout', submit('pay_cert_timeout').result.status === 'SUBMISSION_UNKNOWN', 'SUBMISSION_UNKNOWN'));

  const unknown = normalizePaymentProviderStatus('VENDOR_WEIRD_STATE');
  cases.push(
    caseResult(
      'unknown_status',
      unknown.canonical === 'REQUIRES_RECONCILIATION' && unknown.railStatus === 'UNKNOWN' && unknown.canonical !== 'SETTLED',
      unknown.canonical,
    ),
  );
  const retry = decidePaymentResubmission({
    certainty: classifySubmissionCertainty({ submitted: true, providerAcknowledged: false, executionUnknown: true }),
    railStatus: 'SUBMISSION_UNKNOWN',
  });
  cases.push(caseResult('unknown_requires_query', retry.allowed === false && retry.nextAction === 'QUERY', retry.reason));

  const secret = new SecretValue('cert-webhook-secret');
  const ingestor = new FinancialWebhookIngestor();
  ingestor.registerProvider(capability.provider, secret);
  const nowMs = Date.parse(NOW);
  const envelope = ingestor.sign(
    {
      schemaVersion: WEBHOOK_SCHEMA_VERSION,
      providerId: capability.provider,
      eventType: 'payment.settled',
      timestampUtc: NOW,
      nonce: 'nonce-cert-1',
      idempotencyKey: 'hook-cert-1',
      payloadHash: 'abc',
    },
    secret,
  );
  const first = ingestor.ingest({ envelope, payload: { paymentId: submitted.id }, nowMs });
  const second = ingestor.ingest({ envelope, payload: { paymentId: submitted.id }, nowMs });
  cases.push(caseResult('webhook_duplicate', first.accepted && second.accepted && second.duplicate === true, 'duplicate'));

  const recon = new SimulatedFinancialReconciliationAdapter(capability.provider);
  const completeness = incompleteWithoutReconciliation({
    canSubmit: true,
    canReconcile: recon.fetchStatement({
      provider: capability.provider,
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T00:00:00.000Z',
      sourceVersion: 'cert',
    }).present,
  });
  cases.push(caseResult('reconciliation', completeness.integrationComplete === true, 'complete'));
  return suiteResult('PAYMENT', cases);
}
