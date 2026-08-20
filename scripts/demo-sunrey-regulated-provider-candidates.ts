import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import {
  createFixtureIdentityProviderPorts,
  fixtureIdentityProviderProfile,
} from '../packages/identity/src/provider-candidate/index.ts';
import {
  createFixtureComplianceProviderPorts,
  fixtureSanctionsProviderProfile,
} from '../packages/kernel/src/compliance/provider-candidate/index.ts';
import { FixtureTravelRuleCandidate } from '../packages/custody/src/provider-candidate/index.ts';
import { MarketSurveillanceService } from '../packages/market-surveillance/src/service.ts';
import { FixtureSurveillanceProvider } from '../packages/market-surveillance/src/provider-candidate/index.ts';

const NOW = asUtcInstant('2026-08-20T12:00:00.000Z');

function main(): void {
  const clock = new FrozenClock(NOW);
  const identityPorts = createFixtureIdentityProviderPorts();
  const identity = identityPorts.identityVerification.verifyPerson('idn_fixture_person', clock.now());
  console.log('fixture identity verification');
  console.log(`  providerRef=${identity.providerRef}`);
  console.log(`  outcome=${identity.outcome}`);

  const compliancePorts = createFixtureComplianceProviderPorts();
  const request = {
    subjectKind: 'PERSON' as const,
    subjectRef: 'fixture-subject-clear',
    jurisdiction: 'GB',
    now: clock.now(),
  };
  const sanctions = compliancePorts.sanctions.screen(request);
  const pep = compliancePorts.pep.screen(request);
  console.log('fixture sanctions/PEP');
  console.log(`  sanctions=${sanctions.outcome} pep=${pep.outcome}`);
  console.log('  existing Kernel policy remains the decision layer');

  const travel = new FixtureTravelRuleCandidate();
  const prepared = travel.prepare({
    messageId: 'trm-demo',
    withdrawalId: 'wd-demo',
    recipientBinding: 'vasp:demo-counterparty',
    originatorRef: 'originator-ref',
    beneficiaryRef: 'beneficiary-ref',
    amountMinor: '2500',
    currency: 'USD',
  });
  if ('ok' in prepared) {
    throw new Error('travel-rule prepare failed');
  }
  travel.submit('trm-demo');
  const ack = travel.acknowledge({ messageId: 'trm-demo', recipientBinding: 'vasp:demo-counterparty' });
  if ('ok' in ack) {
    throw new Error('travel-rule ack failed');
  }
  console.log('fixture Travel Rule');
  console.log(`  encrypted=${ack.envelope.ciphertext.length > 0} acknowledged=${ack.acknowledged}`);

  const surveillance = new MarketSurveillanceService({
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
    clock,
  });
  const provider = new FixtureSurveillanceProvider();
  const ingested = provider.ingest(surveillance, {
    signalId: 'sig-demo',
    kind: 'SELF_TRADING',
    marketId: 'mkt-demo',
    accountId: 'acct-demo',
    participantId: 'part-demo',
    observedAt: clock.now(),
  });
  console.log('fixture surveillance signal');
  console.log(`  alerts=${ingested.alertCount} enforcement=${provider.isEnforcementAuthority()}`);

  console.log(`identityProfile=${fixtureIdentityProviderProfile().providerId}`);
  console.log(`sanctionsProfile=${fixtureSanctionsProviderProfile().providerId}`);
  console.log(`REAL_KYC_PROVIDER_CONNECTED=false`);
  console.log(`REAL_AML_PROVIDER_CONNECTED=false`);
  console.log(`REAL_TRAVEL_RULE_NETWORK_CONNECTED=false`);
  console.log(`REAL_SURVEILLANCE_PROVIDER_CONNECTED=false`);
  console.log(`PROVIDER_CLEAR_EQUALS_KERNEL_ALLOW=false`);
  console.log(`TRAVEL_RULE_ACK_AUTHORIZES_WITHDRAWAL=false`);
  console.log(`AI_CAN_APPROVE_COMPLIANCE=false`);
  console.log(`LIVE_EXTERNAL_KYC=${String(LIVE_EXTERNAL_KYC)}`);
  console.log(`PRODUCTION_ACTIVE=false`);
  console.log(`ENVIRONMENT=${ENVIRONMENT}`);
}

main();
