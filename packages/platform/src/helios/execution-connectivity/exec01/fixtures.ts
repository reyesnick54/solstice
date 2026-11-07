import { asUtcInstant } from '../../../../../domain/src/time.ts';
import {
  paperBrokerAccountFixture,
  paperBrokerProviderRegistration,
  paperBrokerSessionFixture,
  type BrokerConnectivityEnvelope,
} from '../../../../../investments/src/broker-connectivity/index.ts';
import { EXEC01_PAPER_BROKER_PROVIDER_ID } from '../../../../../investments/src/broker-connectivity/taxonomy.ts';
import { HELIOS_EXEC01_CONNECTIVITY_SCHEMA } from '../../../../../investments/src/broker-connectivity/taxonomy.ts';

const FIXTURE_AT = asUtcInstant('2026-11-07T16:00:00.000Z');

export function exec01SandboxConnectivityEnvelopeFixture(): BrokerConnectivityEnvelope {
  const provider = paperBrokerProviderRegistration(FIXTURE_AT);
  const account = paperBrokerAccountFixture({
    customerId: 'cust_exec01_fixture',
    canonicalAccountId: 'acct_exec01_fixture',
    providerAccountRef: 'paper:acct_exec01_fixture',
    at: FIXTURE_AT,
  });
  const session = paperBrokerSessionFixture({ brokerAccountId: account.brokerAccountId, at: FIXTURE_AT });
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    provider,
    account,
    session,
    connectivityState: 'SANDBOX',
    grantsExecutionAuthority: false,
    liveInvestmentExecution: false,
  });
}

export function exec01PaperBrokerProviderIdFixture(): typeof EXEC01_PAPER_BROKER_PROVIDER_ID {
  return EXEC01_PAPER_BROKER_PROVIDER_ID;
}
