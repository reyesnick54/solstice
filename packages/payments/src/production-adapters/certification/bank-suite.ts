import { asCurrencyCode } from '../../../../domain/src/currency.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { Money } from '../../../../money/src/money.ts';
import { SimulatedBankAdapter } from '../bank/simulated.ts';
import { caseResult, suiteResult, type CertificationSuiteResult } from './harness.ts';

export function runBankCertificationSuite(adapter: SimulatedBankAdapter = new SimulatedBankAdapter()): CertificationSuiteResult {
  const cases = [];
  const customer = adapter.createCustomerProfile({ sunreyCustomerId: 'cust_cert_bank', jurisdiction: 'US' });
  cases.push(caseResult('account_lifecycle_customer', customer.ok, customer.ok ? 'created' : customer.error.code));
  if (!customer.ok) {
    return suiteResult('BANK', cases);
  }
  const opened = adapter.createAccount({
    providerCustomerId: customer.value.providerCustomerId,
    currency: asCurrencyCode('USD'),
    jurisdiction: 'US',
  });
  cases.push(caseResult('account_lifecycle_open', opened.ok && opened.value.status === 'OPEN', opened.ok ? opened.value.status : opened.error.code));
  if (!opened.ok) {
    return suiteResult('BANK', cases);
  }
  const balance = adapter.getBalance(opened.value.providerAccountId);
  cases.push(
    caseResult(
      'balance_retrieval',
      balance.ok && balance.value.isCustomerLedgerBalance === false,
      balance.ok ? 'provider_balance_is_not_ledger' : balance.error.code,
    ),
  );
  const statement = adapter.getStatement(
    opened.value.providerAccountId,
    asUtcInstant('2026-01-01T00:00:00.000Z'),
    asUtcInstant('2026-01-31T00:00:00.000Z'),
  );
  cases.push(caseResult('statement_retrieval', statement.ok && statement.value.present, statement.ok ? 'present' : statement.error.code));
  adapter.recordSimulatedTransaction(
    opened.value.providerAccountId,
    Money.fromMinorUnits(100n, asCurrencyCode('USD')),
    'CREDIT',
  );
  const txs = adapter.getTransactions(opened.value.providerAccountId);
  cases.push(caseResult('transaction_ingestion', txs.ok, txs.ok ? String(txs.value.length) : txs.error.code));
  const restricted = adapter.closeOrRestrictAccount({ providerAccountId: opened.value.providerAccountId, reason: 'RESTRICT' });
  cases.push(caseResult('account_lifecycle_restrict', restricted.ok && restricted.value.status === 'RESTRICTED', restricted.ok ? restricted.value.status : restricted.error.code));
  const health = adapter.health();
  cases.push(
    caseResult(
      'environment_isolation',
      health.live === false && health.connectivity === 'SIMULATION' && adapter.lifecycle === 'SIMULATED',
      health.connectivity,
    ),
  );
  return suiteResult('BANK', cases);
}
