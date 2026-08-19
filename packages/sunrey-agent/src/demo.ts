import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { UserAgentMandateEngine } from './engine.ts';
import { exploreAgentMandateSafety } from './formal.ts';
import { createAgentSandboxScenario } from './sandbox.ts';

const clock = new FrozenClock(asUtcInstant('2026-08-18T12:00:00.000Z'));
const engine = new UserAgentMandateEngine({
  clock,
  kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_demo' }) },
});
const sandbox = createAgentSandboxScenario('demo');
const mandate = engine.createMandate({
  owner: { kind: 'USER', ownerId: 'user_demo', walletId: 'wallet_demo', accountId: sandbox.walletAccountId },
  agentLabel: 'demo-agent',
  modelRef: 'model:sim-v1',
  policyRef: 'policy:agent-mandates-v1',
  mode: 'SIMULATION_ONLY',
  environment: 'simulation',
  permissions: {
    actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT'],
    assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
    markets: [{ marketId: sandbox.marketId }],
    destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: sandbox.destinationId }],
    humanInformationAccess: false,
    allowWildcardAssets: false,
  },
  budget: { perTransaction: 50n, perPeriod: 200n, periodHours: 24, perAsset: {}, perMarket: {}, perActionClass: {} },
  approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
  expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
  frequencyMaxPerPeriod: 4,
  riskPolicyId: 'risk:sim',
  jurisdictionPackId: 'SIM',
  delegatedSigningKeyId: null,
  createdByActorId: 'user_demo',
});
if (!mandate.ok) {
  throw new Error(mandate.error.detail);
}
const proposal = engine.createProposal({
  mandateId: mandate.value.mandateId,
  intent: 'PREPARE_PAYMENT',
  reasonCode: 'PREAPPROVED_MERCHANT',
  strategyRef: null,
  assetId: 'SUNREY_COIN',
  quantity: 10n,
  destinationOrMarket: sandbox.destinationId,
  fees: 1n,
  expectedOutcomeClass: 'PAYMENT_PREPARED',
  operationalRationale: 'Prepare a bounded payment under the user mandate',
  modelRef: 'model:sim-v1',
  networkId: 'net_sunrey_simulation',
});
if (!proposal.ok) {
  throw new Error(proposal.error.detail);
}
console.log(
  JSON.stringify(
    {
      mandate: mandate.value.mandateId,
      proposal: proposal.value.proposalId,
      formal: exploreAgentMandateSafety(),
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
);
