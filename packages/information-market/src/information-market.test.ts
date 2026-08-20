import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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
import { runInformationMarketDemo } from './demo.ts';
import { createSimulationFiatPort } from './fiat.ts';
import { issueOracleAttestation, verifyOracleAttestation } from './oracle.ts';
import { InformationMarketService, REQUESTER_RESEARCH_SPONSOR } from './service.ts';
import { MARKET_LEGAL_STATUS, PRODUCT_AVAILABILITY } from './taxonomy.ts';
import type { CompensationOffer } from './types.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T16:00:00.000Z');
const GB = asJurisdiction('GB');

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

describe('information market', () => {
  it('runs the deterministic research scenario', async () => {
    const result = await runInformationMarketDemo();
    assert.equal(result.published, true);
    assert.equal(result.evaluated, 20);
    assert.equal(result.matched, 15);
    assert.equal(result.offered, 15);
    assert.equal(result.accepted, 12);
    assert.equal(result.declined, 3);
    assert.equal(result.aggregateOnly, true);
    assert.equal(result.rawExportDenied, true);
    assert.equal(result.proofs, 12);
    assert.equal(result.proofsHaveNoRaw, true);
    assert.equal(result.fiatSettled, 6);
    assert.equal(result.coinSettled, 6);
    assert.equal(result.marketplaceCannotMint, true);
    assert.equal(result.exchangeNotImplemented, true);
    assert.equal(result.aiTrainingDisabled, true);
    assert.equal(result.demandIsNotCoinPrice, true);
    assert.equal(result.billingUnblended, true);
    assert.equal(result.chainHashesOnly, true);
    assert.equal(result.duplicateDenied, true);
    assert.equal(result.evidenceChain, true);
    assert.equal(result.agentCannotExecute, true);
    assert.equal(result.vcSimulation, 'SIMULATION_ONLY');
    assert.equal(result.publicBrand, 'SunRey Exchange');
    assert.equal(result.legalStatus, 'RESEARCH_REQUIRED');
    assert.equal(result.counselConfirmed, false);
  });

  it('refuses raw export, marketplace mint, order books, and agent execution', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const issuer = new AuthorityIssuer('information-market-test');
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
    const coin = new SunReyCoinService({
      kernel,
      issuer,
      evidence,
      events,
      clock,
      identity: identity.service,
      ledger: new Ledger(issuer, clock),
      consent,
      catalog: {
        customers: { get: (id) => customers.get(id) },
        products: {
          get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
        },
        legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
      },
    });
    const market = new InformationMarketService({
      clock,
      keys,
      evidence,
      events,
      consent,
      cleanRoom,
      coin,
      fiat: {
        creditParticipant: () => ({ outcome: 'REJECTED', code: 'UNUSED', message: 'unused' }),
      },
    });
    const tool = new SubjectScopedInformationMarketTool();
    assert.equal(market.mintFromMarketplace().ok, false);
    assert.equal(market.rejectExchangeOrderBook().ok, false);
    assert.equal(market.requestRawExport({} as never, 'imq_none').ok, false);
    assert.equal(tool.publishRequest().ok, false);
    assert.equal(tool.mint().ok, false);
    assert.equal(tool.addBeneficiary().ok, false);
    assert.equal(tool.sellRawRecords().ok, false);
    assert.equal(PRODUCT_AVAILABILITY.AI_TRAINING_PERMISSION, 'PLANNED_DISABLED');
    assert.equal(MARKET_LEGAL_STATUS.liveBuyer, false);
    assert.equal(market.exchangeBoundary().orderBookImplemented, false);
  });

  it('does not treat acceptance as blanket consent and blocks prohibited uses', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const issuer = new AuthorityIssuer('information-market-policy');
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
    const cust = customer('cust_im_policy');
    customers.set(cust.id, cust);
    const sponsor = provision(identity, 'actor_im_policy', 'idn_im_policy', cust.id, [
      'INFORMATION_MARKET_OPERATE',
      'CLEAN_ROOM_REQUEST',
      'CONSENT_VIEW_OWN',
    ]);
    const subject = provision(identity, 'actor_im_subject', 'idn_im_subject', 'cust_im_subject', [
      'CONSENT_GRANT_OWN',
      'CONSENT_VIEW_OWN',
    ]);
    const coin = new SunReyCoinService({
      kernel,
      issuer,
      evidence,
      events,
      clock,
      identity: identity.service,
      ledger: new Ledger(issuer, clock),
      consent,
      catalog: {
        customers: { get: (id) => customers.get(id) },
        products: {
          get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
        },
        legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
      },
    });
    const market = new InformationMarketService({
      clock,
      keys,
      evidence,
      events,
      consent,
      cleanRoom,
      coin,
      fiat: createSimulationFiatPort({
        kernel,
        issuer,
        ledger: new Ledger(issuer, clock),
        identity: identity.service,
        clock,
        customers,
      }),
    });
    market.registerRequester({
      requesterId: REQUESTER_RESEARCH_SPONSOR,
      kind: 'RESEARCH_INSTITUTION',
      legalEntityRef: 'le_research_alpha_sim',
      jurisdiction: 'GB',
      permittedProductClasses: ['RESEARCH_PARTICIPATION'],
      allowedPurposes: ['DATA_CONTRIBUTION_RESEARCH'],
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      actorSubjectId: sponsor.subjectId,
    });
    const prohibited = market.draftRequest(sponsor, {
      requesterId: REQUESTER_RESEARCH_SPONSOR,
      productType: 'RESEARCH_PARTICIPATION',
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
      prohibitedUses: ['SALE_OF_RAW_GENETIC_DATA'],
    });
    assert.equal(prohibited.ok, true);
    if (prohibited.ok) {
      const published = market.publishRequest(sponsor, prohibited.value.requestId, sponsor.subjectId);
      assert.equal(published.ok, false);
      if (!published.ok) {
        assert.equal(published.error.code, 'PROHIBITED_USE');
      }
    }
    const priced = market.draftRequest(sponsor, {
      requesterId: REQUESTER_RESEARCH_SPONSOR,
      productType: 'RESEARCH_PARTICIPATION',
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      jurisdiction: 'GB',
      eligibilityCriteria: { AGE_BAND: '25-34' },
      requestedDataCategories: ['TRANSACTION_DATA'],
      requiredAttestations: ['AGE_BAND'],
      allowedOutputType: 'AGGREGATE',
      participantLimit: 15,
      defaultCompensation: {
        asset: 'SUNREY_COIN',
        coin: AssetQuantity.fromScaledUnits(1n, SUNREY_COIN_ASSET_ID),
        realization: 'OFFERED',
        usdConversion: 'UNAVAILABLE',
      },
      expiresAt: EXPIRES,
      retentionDays: 30,
      consentRequirements: ['DATA_CONTRIBUTION_RESEARCH'],
    });
    assert.equal(priced.ok, true);
    const allowed = market.draftRequest(sponsor, {
      requesterId: REQUESTER_RESEARCH_SPONSOR,
      productType: 'RESEARCH_PARTICIPATION',
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
    assert.equal(allowed.ok, true);
    if (allowed.ok) {
      const published = market.publishRequest(sponsor, allowed.value.requestId, sponsor.subjectId);
      assert.equal(published.ok, true);
      if (published.ok) {
        market.registerEligibilityFact({
          subjectId: subject.subjectId,
          ageBand: '25-34',
          researchInclusion: true,
          savingsBehaviorMaintained: true,
        });
        const eligibility = market.evaluateEligibility(published.value.requestId, [subject.subjectId]);
        assert.equal(eligibility.ok, true);
        const offered = market.offerOpportunities(sponsor, published.value.requestId, [subject.subjectId]);
        assert.equal(offered.ok, true);
        if (offered.ok) {
          const accepted = market.acceptOpportunity(subject, offered.value[0]!.opportunityId, 'consent_missing');
          assert.equal(accepted.ok, false);
          if (!accepted.ok) {
            assert.equal(accepted.error.code, 'CONSENT_REQUIRED');
          }
        }
      }
    }
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, sponsor.subjectId);
  });

  it('signs oracle attestations without revealing source records and expires them', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const issued = issueOracleAttestation({
      keys,
      fact: { subjectId: 'sub_1', ageBand: '25-34' },
      claimType: 'AGE_BAND',
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      now: NOW,
    });
    if (!issued.ok) {
      throw new Error('expected ok');
    }
    assert.equal(issued.value.sourceRecordRevealed, false);
    const verified = verifyOracleAttestation({ keys, attestation: issued.value, now: NOW });
    assert.equal(verified.ok, true);
    const expired = verifyOracleAttestation({
      keys,
      attestation: issued.value,
      now: asUtcInstant('2026-08-17T16:00:00.000Z'),
    });
    assert.equal(expired.ok, false);
    const tampered = verifyOracleAttestation({
      keys,
      attestation: { ...issued.value, signatureHex: '00' },
      now: NOW,
    });
    assert.equal(tampered.ok, false);
  });

  it('restores a snapshot including replay keys', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const issuer = new AuthorityIssuer('information-market-snap');
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
    const coin = new SunReyCoinService({
      kernel,
      issuer,
      evidence,
      events,
      clock,
      identity: identity.service,
      ledger: new Ledger(issuer, clock),
      consent,
      catalog: {
        customers: { get: () => undefined },
        products: { get: () => undefined },
        legalEntities: { get: () => undefined },
      },
    });
    const market = new InformationMarketService({
      clock,
      keys,
      evidence,
      events,
      consent,
      cleanRoom,
      coin,
      fiat: {
        creditParticipant: () => ({ outcome: 'REJECTED', code: 'UNUSED', message: 'unused' }),
      },
    });
    market.store.replayKeys.add('imq_1:sub:reward');
    const snap = market.snapshot();
    const other = new InformationMarketService({
      clock,
      keys,
      evidence,
      events,
      consent,
      cleanRoom,
      coin,
      fiat: {
        creditParticipant: () => ({ outcome: 'REJECTED', code: 'UNUSED', message: 'unused' }),
      },
    });
    other.restore(snap);
    const denied = other.denyDuplicateReward('imq_1', 'sub');
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'DUPLICATE_REWARD');
    }
  });
});
