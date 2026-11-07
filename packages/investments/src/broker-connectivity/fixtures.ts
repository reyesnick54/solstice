import type { UtcInstant } from '../../../domain/src/time.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EXEC01_PAPER_BROKER_PROVIDER_ID, HELIOS_EXEC01_CONNECTIVITY_SCHEMA } from './taxonomy.ts';
import type { BrokerConnectivityEnvelope } from './types.ts';
import { paperBrokerAccountFixture, paperBrokerProviderRegistration, paperBrokerSessionFixture } from './paper-bridge.ts';

const FIXTURE_AT = asUtcInstant('2026-11-07T16:00:00.000Z');

export function exec01SandboxConnectivityEnvelopeFixture(at: UtcInstant = FIXTURE_AT): BrokerConnectivityEnvelope {
  const provider = paperBrokerProviderRegistration(at);
  const account = paperBrokerAccountFixture({
    customerId: 'cust_exec01_fixture',
    canonicalAccountId: 'acct_exec01_fixture',
    providerAccountRef: 'paper:acct_exec01_fixture',
    at,
  });
  const session = paperBrokerSessionFixture({ brokerAccountId: account.brokerAccountId, at });
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
