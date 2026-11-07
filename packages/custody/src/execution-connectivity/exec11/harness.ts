import { asUtcInstant } from '../../../../domain/src/time.ts';
import { toIdentityFacts } from '../../../../kernel/src/regulated/identity-port.ts';
import { screeningResponseToFact } from '../../../../kernel/src/regulated/screening.ts';
import { createSimulationProviders } from '../../../../kernel/src/compliance/simulation.ts';
import {
  evaluateWithdrawalGate,
  registerDestination,
  sandboxHsm,
  SandboxIdentityKycProvider,
  SandboxTravelRuleProvider,
  transitionDestination,
} from '../../regulated/index.ts';
import { defaultGrowTradingAgentGrant, evaluateCustodyMovementIsolation, tradeGrantImpliesWithdraw } from './authority-isolation.ts';
import { authorizeAgentWithdrawalAction } from './agent-boundary.ts';
import { railUsesChainConfirmation, resolveCustodyRailPath, securitiesCustodyPath } from './custody-rail.ts';
import {
  AGENT_ALLOWED_WITHDRAWAL_ACTIONS,
  AGENT_FORBIDDEN_WITHDRAWAL_ACTIONS,
  CUSTODY_MOVEMENT_AUTHORITIES,
} from './taxonomy.ts';
import type { Exec11QualificationChecks } from './types.ts';
import { evaluateWithdrawalAuthorityRequirements, withdrawalRequirementsComplete } from './withdrawal-requirements.ts';

const NOW = asUtcInstant('2026-09-21T12:00:00.000Z');

function fixtureIdentity() {
  return toIdentityFacts(
    { subjectRef: 'exec11', actorId: 'actor.exec11', jurisdiction: 'GB', now: NOW },
    new SandboxIdentityKycProvider().verify({
      subjectRef: 'exec11',
      actorId: 'actor.exec11',
      jurisdiction: 'GB',
      now: NOW,
    }),
  );
}

function fixtureScreening() {
  const providers = createSimulationProviders();
  const request = { subjectKind: 'PERSON' as const, subjectRef: 'exec11', jurisdiction: 'GB', now: NOW };
  return Object.freeze([
    screeningResponseToFact('SANCTIONS', request, providers.sanctions.screen(request)),
    screeningResponseToFact('PEP', request, providers.pep.screen(request)),
  ]);
}

function fixtureApprovedDestination() {
  return transitionDestination(
    registerDestination({
      destinationId: 'dest_exec11',
      chainId: 'chn_sunrey_development',
      networkId: 'net_sunrey_development',
      address: 'sr1_exec11_out',
    }),
    'APPROVED',
  );
}

function fixtureRegulatedGateEligible() {
  const destination = fixtureApprovedDestination();
  return evaluateWithdrawalGate({
    identity: fixtureIdentity(),
    screening: fixtureScreening(),
    travelRule: null,
    travelRuleRecord: null,
    destination,
    chainId: destination.chainId,
    networkId: destination.networkId,
    address: destination.address,
    velocityExceeded: false,
    riskBlocked: false,
    custodyApproved: true,
    dualControlSatisfied: true,
    requiredApprovals: 2,
    approvalCount: 2,
    signingReady: true,
    securityHalt: false,
    jurisdictionDenied: false,
    providerOutage: null,
    hsm: sandboxHsm(true),
  });
}

export function runExec11CustodyIsolationHarness(): Exec11QualificationChecks {
  const growGrant = defaultGrowTradingAgentGrant('grant_grow_exec11');

  const tradeDeniedWithdraw = evaluateCustodyMovementIsolation({
    requestId: 'req_trade_only_withdraw',
    authority: 'WITHDRAW',
    rail: 'DIGITAL_ASSET',
    grant: growGrant,
  });
  const tradeDeniedTransfer = evaluateCustodyMovementIsolation({
    requestId: 'req_trade_only_transfer',
    authority: 'TRANSFER',
    rail: 'DIGITAL_ASSET',
    grant: growGrant,
  });
  const tradePermitted = evaluateCustodyMovementIsolation({
    requestId: 'req_trade_ok',
    authority: 'TRADE',
    rail: 'SECURITIES',
    grant: growGrant,
  });

  const requirementsOk = evaluateWithdrawalAuthorityRequirements({
    rail: 'DIGITAL_ASSET',
    customerMandatePresent: true,
    destinationValidated: true,
    kernelAuthorizationPresent: true,
    stepUpSatisfied: true,
    complianceScreeningCleared: true,
    travelRuleComplete: true,
    travelRuleApplicable: true,
    custodyProviderAccepted: true,
  });

  const digitalPath = resolveCustodyRailPath('DIGITAL_ASSET', true);
  const securitiesPath = securitiesCustodyPath();

  const agentAllows = AGENT_ALLOWED_WITHDRAWAL_ACTIONS.every(
    (action) => authorizeAgentWithdrawalAction(action).outcome === 'ALLOWED',
  );
  const agentDenies = AGENT_FORBIDDEN_WITHDRAWAL_ACTIONS.every(
    (action) => authorizeAgentWithdrawalAction(action).outcome === 'DENIED',
  );

  const gateEligible = fixtureRegulatedGateEligible();

  return Object.freeze({
    authoritiesExplicitlySeparated: CUSTODY_MOVEMENT_AUTHORITIES.length === 4,
    growTradeDoesNotGrantWithdraw: tradeDeniedWithdraw.decision === 'DENIED',
    growTradeDoesNotGrantTransfer: tradeDeniedTransfer.decision === 'DENIED',
    withdrawalRequirementsEnumerated: withdrawalRequirementsComplete().length === 7,
    withdrawalGateComposable: gateEligible.decision === 'ELIGIBLE' && gateEligible.postsJournal === false,
    agentCannotApproveWithdrawal: authorizeAgentWithdrawalAction('APPROVE_OWN_WITHDRAWAL').outcome === 'DENIED',
    agentCannotCreateDestination: authorizeAgentWithdrawalAction('CREATE_DESTINATION').outcome === 'DENIED',
    digitalAssetPreservesProviderBoundaries:
      digitalPath.hsmMpcBoundaryPreserved &&
      digitalPath.destinationScreeningRequired &&
      digitalPath.chainConfirmationRequired,
    securitiesAvoidsCryptoSemantics:
      !securitiesPath.forcedCryptoSemantics && !railUsesChainConfirmation('SECURITIES'),
    tradeNeverImpliesWithdraw: !tradeGrantImpliesWithdraw(growGrant) && tradePermitted.decision === 'PERMITTED',
    fixtureQualificationHarnessPasses:
      agentAllows && agentDenies && requirementsOk.allSatisfied && !tradeGrantImpliesWithdraw(growGrant),
  });
}
