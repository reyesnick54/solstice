import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { Ledger } from '../../ledger/src/journal.ts';
import { Money } from '../../money/src/money.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { ConsentDataUseAuthorization } from '../../consent/src/authorization.ts';
import { RECIPIENT_EXTERNAL_RESEARCH } from '../../consent/src/recipients.ts';
import { ConsentService } from '../../consent/src/service.ts';
import { REQUESTER_RESEARCH_ALPHA } from '../../clean-room/src/requesters.ts';
import { CleanRoomService } from '../../clean-room/src/service.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { PersonalEconomicValueEngine } from '../../platform/src/value/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import { SunReyCoinService } from '../../sunrey-coin/src/service.ts';
import { SubjectScopedInformationMarketTool } from './agent-tool.ts';
import { createSimulationFiatPort } from './fiat.ts';
import { REQUESTER_RESEARCH_SPONSOR, InformationMarketService } from './service.ts';
import { MARKET_LEGAL_STATUS } from './taxonomy.ts';
import type { CompensationOffer } from './types.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T16:00:00.000Z');
const GB = asJurisdiction('GB');
const SUBJECT_CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
  'DECLARE_ECONOMIC_FACT',
  'VIEW_ECONOMIC_GRAPH',
  'VIEW_ECONOMIC_VALUE',
  'SUNREY_COIN_VIEW',
  'SUNREY_COIN_OPERATE_REQUEST',
] as const;

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T16:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function provision(
  identity: SimulatedIdentityAdapter,
  actorId: string,
  identityId: string,
  customerId: string,
  capabilities: readonly string[],
): VerifiedActorContext {
  const result = identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: asCustomerId(customerId),
    capabilities: [...capabilities] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function fiatOffer(): CompensationOffer {
  return {
    asset: 'FIAT_MONEY',
    fiat: Money.fromMinorUnits(2500n, 'USD'),
    realization: 'OFFERED',
    usdConversion: 'UNAVAILABLE',
  };
}

function coinOffer(units: bigint): CompensationOffer {
  return {
    asset: 'SUNREY_COIN',
    coin: AssetQuantity.fromScaledUnits(units, SUNREY_COIN_ASSET_ID),
    realization: 'OFFERED',
    usdConversion: 'UNAVAILABLE',
  };
}

export async function runInformationMarketDemo(): Promise<Record<string, unknown>> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('information-market-demo');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const cleanRoom = new CleanRoomService({ clock, keys, evidence, events, consent, vault });
  const customers = new Map<string, Customer>();
  const ledger = new Ledger(issuer, clock);
  const coin = new SunReyCoinService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    ledger,
    consent,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
  });
  const peve = new PersonalEconomicValueEngine({ clock, events, evidence });
  const fiat = createSimulationFiatPort({
    kernel,
    issuer,
    ledger,
    identity: identity.service,
    clock,
    customers,
  });
  const market = new InformationMarketService({
    clock,
    keys,
    evidence,
    events,
    consent,
    cleanRoom,
    coin,
    fiat,
    peve,
  });
  const tool = new SubjectScopedInformationMarketTool();

  const subjects: VerifiedActorContext[] = [];
  for (let i = 0; i < 20; i += 1) {
    const cust = customer(`cust_im_${i}`);
    customers.set(cust.id, cust);
    const actor = provision(identity, `actor_im_${i}`, `idn_im_${i}`, cust.id, SUBJECT_CAPS);
    vault.openVault(actor, actor.subjectId, cust.id);
    const grocery = vault.ingest(actor, {
      subjectId: actor.subjectId,
      sourceId: 'pds_sim_transactions',
      sourceRecordRef: `grocery_${i}`,
      idempotencyKey: `grocery_${i}`,
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: {
        transactions: [
          {
            id: `g_${i}`,
            bookedAt: '2026-07-08T10:00:00.000Z',
            merchant: 'Green Market',
            category: 'grocery',
            amountMinor: String(1200 + i * 80),
            currency: 'USD',
          },
        ],
      },
      provenanceKind: 'EXTERNAL_CONNECTOR',
      purposeRef: 'demo.ingest.transactions',
    });
    if (!grocery.ok) {
      throw new Error(grocery.error.message);
    }
    const draft = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      operations: ['AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: NOW,
      expiresAt: EXPIRES,
      idempotencyKey: `im.grant.${i}`,
    });
    if (!draft.ok) {
      throw new Error(draft.error.message);
    }
    const confirmed = consent.confirmConsent(actor, draft.value.consentId, `im.confirm.${i}`);
    if (!confirmed.ok) {
      throw new Error(confirmed.error.message);
    }
    market.registerEligibilityFact({
      subjectId: actor.subjectId,
      ageBand: i < 15 ? '25-34' : '45-54',
      researchInclusion: i < 15,
      savingsBehaviorMaintained: i < 15,
      vaultMetadataCategories: ['TRANSACTION_DATA'],
      pegRef: `peg:im:${i}`,
    });
    subjects.push(actor);
  }

  const sponsorCust = customer('cust_im_sponsor');
  customers.set(sponsorCust.id, sponsorCust);
  const sponsor = provision(identity, 'actor_im_sponsor', 'idn_im_sponsor', sponsorCust.id, [
    'INFORMATION_MARKET_OPERATE',
    'INFORMATION_MARKET_VIEW',
    'CLEAN_ROOM_REQUEST',
    'CONSENT_VIEW_OWN',
    'SUNREY_COIN_VIEW',
    'SUNREY_COIN_OPERATE_REQUEST',
    'ACCOUNT_OPEN_REQUEST',
    'POST_DEPOSIT_REQUEST',
    'OPERATE_GROWTH_ORCHESTRATOR',
    'VIEW_ECONOMIC_VALUE',
  ]);
  cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, sponsor.subjectId);

  const fundingSession = cleanRoom.createSession(sponsor, {
    requesterId: REQUESTER_RESEARCH_ALPHA,
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    proposedSubjectIds: subjects.map((row) => row.subjectId),
    expiresAt: EXPIRES,
    idempotencyKey: 'im.funding.session',
  });
  if (!fundingSession.ok) {
    throw new Error(fundingSession.error.message);
  }
  const fundingAuth = cleanRoom.authorizeSession(sponsor, fundingSession.value.sessionId);
  if (!fundingAuth.ok) {
    throw new Error(fundingAuth.error.message);
  }
  const fundingCompute = cleanRoom.submitAndExecute(sponsor, fundingSession.value.sessionId, 'grocery_average');
  if (!fundingCompute.ok || !fundingCompute.value.receipt) {
    throw new Error(fundingCompute.ok ? 'missing funding receipt' : fundingCompute.error.message);
  }
  const funder = subjects[19]!;
  const funderContribution = fundingCompute.value.contributions.find((row) => row.subjectId === funder.subjectId);
  if (!funderContribution) {
    throw new Error('expected funding contribution');
  }
  const evaluated = coin.evaluateContribution({
    actor: funder,
    subjectId: funder.subjectId,
    customerId: asCustomerId('cust_im_19'),
    receipt: fundingCompute.value.receipt,
    contribution: funderContribution,
  });
  if (!evaluated.ok) {
    throw new Error(evaluated.error.message);
  }
  const proposal = coin.proposeIssuance(funder, evaluated.value.vectorId);
  if (!proposal.ok) {
    throw new Error(proposal.error.message);
  }
  const issued = coin.issue(funder.actorId, proposal.value.proposalId, asCustomerId('cust_im_19'));
  if (issued.outcome !== 'OK') {
    throw new Error(issued.outcome === 'KERNEL_REFUSED' ? issued.decision.status : issued.message);
  }
  const funded = coin.transfer(
    funder.actorId,
    asCustomerId('cust_im_19'),
    funder.subjectId,
    sponsor.subjectId,
    evaluated.value.amount,
  );
  if (funded.outcome !== 'OK') {
    throw new Error(funded.outcome === 'KERNEL_REFUSED' ? funded.decision.status : funded.message);
  }

  const coinUnits = 100_000n;
  market.registerRequester({
    requesterId: REQUESTER_RESEARCH_SPONSOR,
    kind: 'RESEARCH_INSTITUTION',
    legalEntityRef: 'le_research_alpha_sim',
    jurisdiction: 'GB',
    permittedProductClasses: ['RESEARCH_PARTICIPATION', 'AGGREGATE_QUERY', 'SECURE_COHORT_ANALYTICS'],
    allowedPurposes: ['DATA_CONTRIBUTION_RESEARCH'],
    recipientId: RECIPIENT_EXTERNAL_RESEARCH,
    actorSubjectId: sponsor.subjectId,
  });
  const compensationByIndex = [
    ...Array.from({ length: 6 }, () => fiatOffer()),
    ...Array.from({ length: 6 }, () => coinOffer(coinUnits)),
    ...Array.from({ length: 3 }, () => fiatOffer()),
  ];
  const drafted = market.draftRequest(sponsor, {
    requesterId: REQUESTER_RESEARCH_SPONSOR,
    productType: 'RESEARCH_PARTICIPATION',
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    jurisdiction: 'GB',
    eligibilityCriteria: {
      AGE_BAND: '25-34',
      RESEARCH_INCLUSION: true,
      SAVINGS_BEHAVIOR_MAINTAINED: true,
    },
    requestedDataCategories: ['TRANSACTION_DATA'],
    requiredAttestations: ['AGE_BAND', 'RESEARCH_INCLUSION', 'SAVINGS_BEHAVIOR_MAINTAINED'],
    allowedOutputType: 'AGGREGATE',
    participantLimit: 15,
    compensationByIndex,
    defaultCompensation: fiatOffer(),
    expiresAt: EXPIRES,
    retentionDays: 30,
    consentRequirements: ['DATA_CONTRIBUTION_RESEARCH'],
  });
  if (!drafted.ok) {
    throw new Error(drafted.error.message);
  }
  const published = market.publishRequest(sponsor, drafted.value.requestId, sponsor.subjectId);
  if (!published.ok) {
    throw new Error(published.error.message);
  }
  const eligibility = market.evaluateEligibility(
    published.value.requestId,
    subjects.map((row) => row.subjectId),
  );
  if (!eligibility.ok) {
    throw new Error(eligibility.error.message);
  }
  const matched = eligibility.value.filter((row) => row.matched).map((row) => row.subjectId);
  const offered = market.offerOpportunities(sponsor, published.value.requestId, matched);
  if (!offered.ok) {
    throw new Error(offered.error.message);
  }
  const acceptors = offered.value.slice(0, 12);
  const declined = offered.value.slice(12);
  const consents: string[] = [];
  for (const opportunity of acceptors) {
    const subject = subjects.find((row) => row.subjectId === opportunity.subjectId);
    if (!subject) {
      throw new Error('missing subject');
    }
    const listed = consent.listActiveConsents(subject, subject.subjectId);
    if (!listed.ok || !listed.value[0]) {
      throw new Error('expected active consent');
    }
    consents.push(listed.value[0].consentId);
    const accepted = market.acceptOpportunity(subject, opportunity.opportunityId, listed.value[0].consentId);
    if (!accepted.ok) {
      throw new Error(accepted.error.message);
    }
  }
  for (const opportunity of declined) {
    const subject = subjects.find((row) => row.subjectId === opportunity.subjectId);
    if (!subject) {
      throw new Error('missing subject');
    }
    const result = market.declineOpportunity(subject, opportunity.opportunityId);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  }
  const computed = market.runAuthorizedCompute(
    sponsor,
    published.value.requestId,
    acceptors.map((row) => row.subjectId),
  );
  if (!computed.ok) {
    throw new Error(computed.error.message);
  }
  const raw = market.requestRawExport(sponsor, published.value.requestId);
  const settled = market.settleAccepted(sponsor, published.value.requestId, {
    sponsorOwnerId: sponsor.subjectId,
    sponsorCustomerId: sponsorCust.id,
    participants: acceptors.map((row, index) => ({
      subjectId: row.subjectId,
      customerId: `cust_im_${subjects.findIndex((item) => item.subjectId === row.subjectId)}`,
      accountId: `acct_im_${index}`,
    })),
  });
  if (!settled.ok) {
    throw new Error(settled.error.message);
  }
  const duplicate = market.denyDuplicateReward(published.value.requestId, acceptors[0]!.subjectId);
  const closed = market.closeRequest(sponsor, published.value.requestId);
  if (!closed.ok) {
    throw new Error(closed.error.message);
  }
  const proofs = [...market.store.contributions.values()].filter((row) => row.status === 'SETTLED');
  const demand = market.demandIndex();
  const billing = market.billingFor(fiatOffer());
  const chain = market.chainReference(proofs[0]!.contributionId);
  const mint = market.mintFromMarketplace();
  const orderBook = market.rejectExchangeOrderBook();
  const disabled = market.draftRequest(sponsor, {
    requesterId: REQUESTER_RESEARCH_SPONSOR,
    productType: 'AI_TRAINING_PERMISSION',
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    jurisdiction: 'GB',
    eligibilityCriteria: { AGE_BAND: '25-34' },
    requestedDataCategories: ['TRANSACTION_DATA'],
    requiredAttestations: ['AGE_BAND'],
    allowedOutputType: 'AGGREGATE',
    participantLimit: 15,
    defaultCompensation: fiatOffer(),
    expiresAt: EXPIRES,
    retentionDays: 30,
    consentRequirements: ['DATA_CONTRIBUTION_RESEARCH'],
  });
  const disabledPublish =
    disabled.ok ? market.publishRequest(sponsor, disabled.value.requestId, sponsor.subjectId) : disabled;

  return {
    legalStatus: MARKET_LEGAL_STATUS.status,
    counselConfirmed: MARKET_LEGAL_STATUS.counselConfirmed,
    sponsorVerified: true,
    published: published.value.status === 'PUBLISHED_SIMULATION',
    evaluated: eligibility.value.length,
    matched: matched.length,
    offered: offered.value.length,
    accepted: acceptors.length,
    declined: declined.length,
    aggregateOnly: computed.value.aggregateOnly,
    rawExportDenied: !raw.ok && raw.error.code === 'RAW_EXPORT_DENIED',
    proofs: proofs.length,
    proofsHaveNoRaw: proofs.every((row) => row.rawDataIncluded === false),
    fiatSettled: proofs.filter((row) => market.store.agreements.get(row.compensationAgreementId)?.offer.asset === 'FIAT_MONEY').length,
    coinSettled: proofs.filter((row) => market.store.agreements.get(row.compensationAgreementId)?.offer.asset === 'SUNREY_COIN').length,
    marketplaceCannotMint: !mint.ok,
    exchangeNotImplemented: !orderBook.ok,
    aiTrainingDisabled: !disabledPublish.ok,
    demandIsNotCoinPrice: demand.isCoinPrice === false && demand.isHumanWorth === false,
    billingUnblended: billing.blended === false,
    chainHashesOnly: chain.chainImplemented === false && chain.rawDataIncluded === false,
    duplicateDenied: !duplicate.ok && duplicate.error.code === 'DUPLICATE_REWARD',
    evidenceChain: evidence.verifyChain().ok,
    agentCannotExecute: !tool.publishRequest().ok && !tool.mint().ok && !tool.addBeneficiary().ok,
    vcSimulation: market.vcPort.issueSimulationCredential([...market.store.attestations.values()][0]!).mode,
    zkSimulation: market.zkPort.proveSimulation('age_band').mode,
    publicBrand: market.exchangeBoundary().publicBrand,
    consentsUsed: consents.length,
  };
}

async function main(): Promise<void> {
  const result = await runInformationMarketDemo();
  console.log(JSON.stringify(result, null, 2));
  console.log('information-market demo: ok');
}

if (import.meta.url === new URL(process.argv[1] ?? '', `file://${process.cwd()}/`).href || process.argv[1]?.endsWith('information-market/src/demo.ts')) {
  await main();
}
