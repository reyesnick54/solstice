import type { DomainEvent } from '../../events/src/events.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import type { PegPersonaId } from './taxonomy.ts';
import type { SuitabilityAnswers } from './suitability.ts';
import type { DeclaredAssetInput, DeclaredGoalInput, DeclaredIncomeInput, DeclaredLiabilityInput } from './service.ts';

export const PEG_PERSONAS_ARE_SIMULATION_ONLY = true as const;

export type PegPersonaSeed = {
  readonly personaId: PegPersonaId;
  readonly label: string;
  readonly simulationOnly: true;
  readonly subjectId: string;
  readonly customerId: string;
  readonly jurisdiction: string;
  readonly accountCurrencies: readonly { readonly accountId: string; readonly currency: string }[];
  readonly events: readonly DomainEvent[];
  readonly overlays: readonly {
    readonly sourceEventId: string;
    readonly classification: 'SALARY' | 'RENT' | 'SUBSCRIPTION' | 'LOAN_PAYMENT' | 'CARD_SPEND' | 'TRANSFER' | 'UNKNOWN';
    readonly counterpart?: { readonly kind: 'EMPLOYER' | 'LANDLORD' | 'MERCHANT' | 'LENDER'; readonly ref: string; readonly label?: string };
  }[];
  readonly income?: DeclaredIncomeInput;
  readonly assets?: readonly DeclaredAssetInput[];
  readonly liabilities?: readonly DeclaredLiabilityInput[];
  readonly goals?: readonly DeclaredGoalInput[];
  readonly suitability?: SuitabilityAnswers;
};

function event(
  eventType: DomainEvent['eventType'],
  occurredAt: string,
  payload: Record<string, unknown>,
  eventId: string,
): DomainEvent {
  return {
    eventType,
    schemaVersion: 1,
    occurredAt: asUtcInstant(occurredAt),
    eventId,
    payload,
  } as DomainEvent;
}

function salaryRentMonths(
  prefix: string,
  accountId: string,
  salary: string,
  rent: string,
): { readonly events: DomainEvent[]; readonly overlays: PegPersonaSeed['overlays'] } {
  const months = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'] as const;
  const events: DomainEvent[] = [];
  const overlays: PegPersonaSeed['overlays'] = [];
  for (const [index, day] of months.entries()) {
    const n = String(index + 1);
    events.push(
      event(
        'DepositPosted',
        `${day}T09:00:00.000Z`,
        { journalId: `j_${prefix}_sal_${n}`, accountId, amountMinorUnits: salary, currency: 'USD' },
        `e_${prefix}_sal_${n}`,
      ),
    );
    overlays.push({
      sourceEventId: `e_${prefix}_sal_${n}`,
      classification: 'SALARY',
      counterpart: { kind: 'EMPLOYER', ref: `${prefix}_acme`, label: 'Acme' },
    });
    events.push(
      event(
        'WithdrawalPosted',
        `${day}T10:00:00.000Z`,
        { journalId: `j_${prefix}_rent_${n}`, accountId, amountMinorUnits: rent, currency: 'USD' },
        `e_${prefix}_rent_${n}`,
      ),
    );
    overlays.push({
      sourceEventId: `e_${prefix}_rent_${n}`,
      classification: 'RENT',
      counterpart: { kind: 'LANDLORD', ref: `${prefix}_oak`, label: 'Oak St' },
    });
  }
  return { events, overlays };
}

function accountOpenedEvent(eventId: string, accountId: string, ownerId: string, accountClass: string): DomainEvent {
  return event(
    'AccountOpened',
    '2026-05-01T00:00:00.000Z',
    { accountId, ownerId, accountClass, executionAuthorityId: 'ea', intentId: eventId },
    eventId,
  );
}

function position(eventId: string, accountId: string, minor: string, currency: string, at = '2026-07-01T00:00:00.000Z'): DomainEvent {
  return event('AccountPositionChanged', at, { accountId, amountMinorUnits: minor, currency }, eventId);
}

export const PEG_PERSONA_SEEDS: readonly PegPersonaSeed[] = Object.freeze([
  Object.freeze({
    personaId: 'NEW_USER',
    label: 'New user with an empty graph',
    simulationOnly: true,
    subjectId: 'idn_peg_new_user',
    customerId: 'cust_peg_new_user',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([]),
    events: Object.freeze([]),
    overlays: Object.freeze([]),
  }),
  Object.freeze({
    personaId: 'HEALTHY_SAVER',
    label: 'Funded reserve and modest surplus',
    simulationOnly: true,
    subjectId: 'idn_peg_healthy_saver',
    customerId: 'cust_peg_healthy_saver',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_saver', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_saver_open', 'acct_peg_saver', 'cust_peg_healthy_saver', 'SAVINGS_DEPOSIT'),
      position('e_saver_pos', 'acct_peg_saver', '9000000', 'USD'),
      ...salaryRentMonths('saver', 'acct_peg_saver', '400000', '120000').events,
    ]),
    overlays: Object.freeze(salaryRentMonths('saver', 'acct_peg_saver', '400000', '120000').overlays),
    goals: Object.freeze([
      {
        goalKind: 'EMERGENCY_FUND',
        label: 'Emergency fund',
        target: { minorUnits: '1200000', currency: 'USD' },
        priority: 1,
        currentAllocatedValue: { minorUnits: '1200000', currency: 'USD' },
      },
    ]),
    suitability: {
      riskTolerance: 'MODERATE',
      liquidReserveMonths: 8,
      knownNearTermNeed: false,
      investmentHorizonYears: 10,
      expectedWithdrawalYears: 12,
      investmentExperience: 'INTERMEDIATE',
      lossSensitivity: 'MODERATE',
      jurisdiction: 'US',
    },
  }),
  Object.freeze({
    personaId: 'HIGH_IDLE_CASH',
    label: 'Large idle cash versus income',
    simulationOnly: true,
    subjectId: 'idn_peg_idle_cash',
    customerId: 'cust_peg_idle_cash',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_idle', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_idle_open', 'acct_peg_idle', 'cust_peg_idle_cash', 'DEMAND_DEPOSIT'),
      position('e_idle_pos', 'acct_peg_idle', '25000000', 'USD'),
      ...salaryRentMonths('idle', 'acct_peg_idle', '300000', '80000').events,
    ]),
    overlays: Object.freeze(salaryRentMonths('idle', 'acct_peg_idle', '300000', '80000').overlays),
  }),
  Object.freeze({
    personaId: 'HIGH_SPENDER',
    label: 'Recurring spend exceeds income',
    simulationOnly: true,
    subjectId: 'idn_peg_spender',
    customerId: 'cust_peg_spender',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_spend', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_spend_open', 'acct_peg_spend', 'cust_peg_spender', 'DEMAND_DEPOSIT'),
      position('e_spend_pos', 'acct_peg_spend', '40000', 'USD'),
      ...salaryRentMonths('spend', 'acct_peg_spend', '200000', '250000').events,
    ]),
    overlays: Object.freeze(salaryRentMonths('spend', 'acct_peg_spend', '200000', '250000').overlays),
  }),
  Object.freeze({
    personaId: 'INVESTOR',
    label: 'Has an investment account node',
    simulationOnly: true,
    subjectId: 'idn_peg_investor',
    customerId: 'cust_peg_investor',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_inv_cash', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_inv_open', 'acct_peg_inv_cash', 'cust_peg_investor', 'DEMAND_DEPOSIT'),
      position('e_inv_pos', 'acct_peg_inv_cash', '500000', 'USD'),
      event(
        'InvestmentAccountOpened',
        '2026-05-02T00:00:00.000Z',
        { accountId: 'acct_peg_brokerage', ownerId: 'cust_peg_investor', label: 'Brokerage' },
        'e_inv_acct',
      ),
    ]),
    overlays: Object.freeze([]),
    assets: Object.freeze([
      {
        assetKind: 'EXTERNAL_BROKERAGE',
        label: 'Declared brokerage',
        estimatedValue: { minorUnits: '1500000', currency: 'USD' },
      },
    ]),
    suitability: {
      riskTolerance: 'HIGH',
      liquidReserveMonths: 6,
      knownNearTermNeed: false,
      investmentHorizonYears: 15,
      expectedWithdrawalYears: 20,
      investmentExperience: 'EXPERIENCED',
      lossSensitivity: 'LOW',
      jurisdiction: 'US',
    },
  }),
  Object.freeze({
    personaId: 'MULTI_CURRENCY_USER',
    label: 'USD and SAR cash; no silent FX total',
    simulationOnly: true,
    subjectId: 'idn_peg_multi_fx',
    customerId: 'cust_peg_multi_fx',
    jurisdiction: 'SA',
    accountCurrencies: Object.freeze([
      { accountId: 'acct_peg_fx_usd', currency: 'USD' },
      { accountId: 'acct_peg_fx_sar', currency: 'SAR' },
    ]),
    events: Object.freeze([
      accountOpenedEvent('e_fx_usd_open', 'acct_peg_fx_usd', 'cust_peg_multi_fx', 'DEMAND_DEPOSIT'),
      accountOpenedEvent('e_fx_sar_open', 'acct_peg_fx_sar', 'cust_peg_multi_fx', 'DEMAND_DEPOSIT'),
      position('e_fx_usd_pos', 'acct_peg_fx_usd', '100000', 'USD'),
      position('e_fx_sar_pos', 'acct_peg_fx_sar', '400000', 'SAR'),
    ]),
    overlays: Object.freeze([]),
  }),
  Object.freeze({
    personaId: 'GOAL_ORIENTED_USER',
    label: 'Active home and education goals',
    simulationOnly: true,
    subjectId: 'idn_peg_goals',
    customerId: 'cust_peg_goals',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_goals', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_goal_open', 'acct_peg_goals', 'cust_peg_goals', 'SAVINGS_DEPOSIT'),
      position('e_goal_pos', 'acct_peg_goals', '2500000', 'USD'),
    ]),
    overlays: Object.freeze([]),
    goals: Object.freeze([
      {
        goalKind: 'HOME',
        label: 'House deposit',
        target: { minorUnits: '8000000', currency: 'USD' },
        priority: 1,
        currentAllocatedValue: { minorUnits: '1500000', currency: 'USD' },
      },
      {
        goalKind: 'EDUCATION',
        label: 'Tuition',
        target: { minorUnits: '3000000', currency: 'USD' },
        priority: 2,
        currentAllocatedValue: { minorUnits: '200000', currency: 'USD' },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'LIQUIDITY_CONSTRAINED_USER',
    label: 'Near-term need and thin cash',
    simulationOnly: true,
    subjectId: 'idn_peg_liquidity',
    customerId: 'cust_peg_liquidity',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_liq', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_liq_open', 'acct_peg_liq', 'cust_peg_liquidity', 'DEMAND_DEPOSIT'),
      position('e_liq_pos', 'acct_peg_liq', '25000', 'USD'),
      ...salaryRentMonths('liq', 'acct_peg_liq', '250000', '200000').events,
    ]),
    overlays: Object.freeze(salaryRentMonths('liq', 'acct_peg_liq', '250000', '200000').overlays),
    liabilities: Object.freeze([
      {
        liabilityKind: 'CREDIT',
        label: 'Card balance',
        estimatedBalance: { minorUnits: '180000', currency: 'USD' },
      },
    ]),
    suitability: {
      riskTolerance: 'HIGH',
      liquidReserveMonths: 1,
      knownNearTermNeed: true,
      investmentHorizonYears: 1,
      expectedWithdrawalYears: 1,
      investmentExperience: 'LIMITED',
      lossSensitivity: 'VERY_HIGH',
      jurisdiction: 'US',
    },
  }),
  Object.freeze({
    personaId: 'HIGH_CONCENTRATION_USER',
    label: 'Concentrated declared holding',
    simulationOnly: true,
    subjectId: 'idn_peg_concentrated',
    customerId: 'cust_peg_concentrated',
    jurisdiction: 'US',
    accountCurrencies: Object.freeze([{ accountId: 'acct_peg_conc', currency: 'USD' }]),
    events: Object.freeze([
      accountOpenedEvent('e_conc_open', 'acct_peg_conc', 'cust_peg_concentrated', 'DEMAND_DEPOSIT'),
      position('e_conc_pos', 'acct_peg_conc', '100000', 'USD'),
    ]),
    overlays: Object.freeze([]),
    assets: Object.freeze([
      {
        assetKind: 'EXTERNAL_BROKERAGE',
        label: 'Single issuer',
        estimatedValue: { minorUnits: '9000000', currency: 'USD' },
      },
    ]),
    suitability: {
      riskTolerance: 'HIGH',
      liquidReserveMonths: 4,
      knownNearTermNeed: false,
      investmentHorizonYears: 8,
      expectedWithdrawalYears: 10,
      investmentExperience: 'EXPERIENCED',
      lossSensitivity: 'LOW',
      largestPositionShareBps: 8500,
      jurisdiction: 'US',
    },
  }),
]);

export function personaSeed(id: PegPersonaId): PegPersonaSeed {
  const seed = PEG_PERSONA_SEEDS.find((row) => row.personaId === id);
  if (!seed) {
    throw new Error(`unknown PEG persona ${id}`);
  }
  return seed;
}

export function applyPersonaSeed(
  peg: import('./service.ts').EconomicGraphService,
  actor: unknown,
  seed: PegPersonaSeed,
): void {
  for (const account of seed.accountCurrencies) {
    peg.registerAccountCurrency(account.accountId, account.currency);
  }
  for (const overlay of seed.overlays) {
    peg.registerOverlay({
      sourceEventId: overlay.sourceEventId,
      subjectId: seed.subjectId,
      classification: overlay.classification,
      ...(overlay.counterpart ? { counterpart: overlay.counterpart } : {}),
    });
  }
  peg.openGraph(actor, seed.subjectId, seed.customerId);
  peg.ingestAll(seed.events, seed.subjectId);
  if (seed.income) {
    peg.declareIncomeSource(actor, seed.subjectId, seed.income);
  }
  for (const asset of seed.assets ?? []) {
    peg.declareAsset(actor, seed.subjectId, asset);
  }
  for (const liability of seed.liabilities ?? []) {
    peg.declareLiability(actor, seed.subjectId, liability);
  }
  for (const goal of seed.goals ?? []) {
    peg.declareGoal(actor, seed.subjectId, goal);
  }
  if (seed.suitability) {
    peg.recordSuitability(actor, seed.subjectId, seed.suitability);
  }
  peg.materializeRecurring(seed.subjectId);
  peg.refreshDerivedIntelligence(seed.subjectId);
}
