import type { UtcInstant } from '../../domain/src/time.ts';
import { classified } from './facts.ts';
import {
  asRegulatoryScenarioId,
  asRegulatoryScenarioSuiteId,
  type RegulatoryScenarioSuiteId,
} from './ids.ts';
import type { RegulatoryScenario, RegulatoryScenarioSuite } from './types.ts';
import type { ScenarioCategory } from './taxonomy.ts';

function scenario(
  id: string,
  name: string,
  category: ScenarioCategory,
  at: UtcInstant,
  facts: RegulatoryScenario['facts'],
  extra: Partial<RegulatoryScenario> = {},
): RegulatoryScenario {
  return Object.freeze({
    scenarioId: asRegulatoryScenarioId(id),
    name,
    category,
    createdAt: at,
    facts,
    hypotheticalOverrides: Object.freeze([]),
    invariant: extra.invariant ?? false,
    ...extra,
  });
}

const US_BASE = {
  jurisdiction: classified('US', 'SYNTHETIC_FACT' as const),
  actorId: classified('rdt_us_actor', 'SYNTHETIC_FACT' as const),
  customerId: classified('cus_rdt_us_retail', 'SYNTHETIC_FACT' as const),
  customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT' as const),
  kycState: classified('VERIFIED', 'SYNTHETIC_FACT' as const),
  kycRecordVersion: classified(2, 'SYNTHETIC_FACT' as const),
  productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT' as const),
  legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT' as const),
};

export function builtInSuites(at: UtcInstant): {
  readonly suites: readonly RegulatoryScenarioSuite[];
  readonly scenarios: readonly RegulatoryScenario[];
} {
  const scenarios: RegulatoryScenario[] = [
    scenario(
      'rsc_us_retail_open',
      'US retail OPEN_ACCOUNT verified',
      'US_RETAIL_ACCOUNT',
      at,
      { ...US_BASE, actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT') },
    ),
    scenario(
      'rsc_sa_retail_open',
      'SA retail OPEN_ACCOUNT verified',
      'SAUDI_RETAIL_ACCOUNT',
      at,
      {
        jurisdiction: classified('SA', 'SYNTHETIC_FACT'),
        actorId: classified('rdt_sa_actor', 'SYNTHETIC_FACT'),
        customerId: classified('cus_rdt_sa_retail', 'SYNTHETIC_FACT'),
        customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
        kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
        kycRecordVersion: classified(2, 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_sar_sa', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_sa_entity', 'SYNTHETIC_FACT'),
        actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_us_sa_payment',
      'US→SA INITIATE_PAYMENT simulation corridor',
      'US_SA_CROSS_BORDER',
      at,
      {
        ...US_BASE,
        actionType: classified('INITIATE_PAYMENT', 'SYNTHETIC_FACT'),
        corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
        corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
        sanctionsHit: classified(false, 'SYNTHETIC_FACT'),
        pepHit: classified(false, 'SYNTHETIC_FACT'),
        fraudHold: classified(false, 'SYNTHETIC_FACT'),
        currency: classified('USD', 'SYNTHETIC_FACT'),
        amountMinorUnits: classified('25000', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_card_request',
      'US card program REQUEST_CARD',
      'CARD_PROGRAM',
      at,
      {
        ...US_BASE,
        actionType: classified('REQUEST_CARD', 'SYNTHETIC_FACT'),
        cardProgramId: classified('SIMULATION_US_VIRTUAL_PROGRAM', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_wallet_provision',
      'US wallet provisioning',
      'WALLET_PROVISIONING',
      at,
      {
        ...US_BASE,
        actionType: classified('PROVISION_CARD_TO_WALLET', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_merchant_accept',
      'US merchant acceptance session',
      'MERCHANT_ACCEPTANCE',
      at,
      {
        ...US_BASE,
        actionType: classified('CREATE_ACCEPTANCE_SESSION', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_high_risk_pep',
      'high-risk PEP payment',
      'HIGH_RISK_CUSTOMER',
      at,
      {
        ...US_BASE,
        actionType: classified('INITIATE_PAYMENT', 'SYNTHETIC_FACT'),
        sanctionsHit: classified(false, 'SYNTHETIC_FACT'),
        pepHit: classified(true, 'SYNTHETIC_FACT'),
        fraudHold: classified(false, 'SYNTHETIC_FACT'),
        corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
        corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_inv_sanctions_block',
      'sanctions match must remain BLOCK',
      'INVARIANT_CONTROL',
      at,
      {
        ...US_BASE,
        actionType: classified('INITIATE_PAYMENT', 'SYNTHETIC_FACT'),
        sanctionsHit: classified(true, 'SYNTHETIC_FACT'),
        pepHit: classified(false, 'SYNTHETIC_FACT'),
        fraudHold: classified(false, 'SYNTHETIC_FACT'),
        corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
        corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
      },
      { invariant: true, expectedInvariantDecision: 'BLOCK' },
    ),
    scenario(
      'rsc_inv_missing_jurisdiction',
      'missing jurisdiction must not ALLOW',
      'INVARIANT_CONTROL',
      at,
      {
        actorId: classified('rdt_us_actor', 'SYNTHETIC_FACT'),
        actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
      },
      { invariant: true, expectedInvariantDecision: 'DEFER' },
    ),
    scenario(
      'rsc_inv_revoked_identity',
      'revoked identity must not gain permission',
      'INVARIANT_CONTROL',
      at,
      {
        ...US_BASE,
        actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        identityRevoked: classified(true, 'SYNTHETIC_FACT'),
      },
      { invariant: true, expectedInvariantDecision: 'DEFER' },
    ),
    scenario(
      'rsc_inv_unsupported_product',
      'unsupported product must not become allowed',
      'INVARIANT_CONTROL',
      at,
      {
        ...US_BASE,
        actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_sar_sa', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_sa_entity', 'SYNTHETIC_FACT'),
        jurisdiction: classified('SA', 'SYNTHETIC_FACT'),
      },
      { invariant: true, expectedInvariantDecision: 'BLOCK' },
    ),
    scenario(
      'rsc_sunrey_coin_issuance',
      'SunRey Coin simulation issuance — unclassified, RESEARCH_REQUIRED',
      'SUNREY_COIN_ISSUANCE',
      at,
      {
        ...US_BASE,
        actionType: classified('ISSUE_SUNREY_COIN', 'SYNTHETIC_FACT'),
        productId: classified('prod_digital_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_sunrey_coin_transfer',
      'SunRey Coin simulation transfer — SIMULATION_ONLY',
      'SUNREY_COIN_TRANSFER',
      at,
      {
        ...US_BASE,
        actionType: classified('TRANSFER_SUNREY_COIN', 'SYNTHETIC_FACT'),
        productId: classified('prod_digital_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_sunrey_coin_reward',
      'SunRey Coin authorized-contribution reward — COUNSEL_REVIEW_REQUIRED',
      'SUNREY_COIN_REWARD',
      at,
      {
        ...US_BASE,
        actionType: classified('ISSUE_SUNREY_COIN', 'SYNTHETIC_FACT'),
        productId: classified('prod_digital_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_sunrey_coin_burn',
      'SunRey Coin simulation burn — RESEARCH_REQUIRED',
      'SUNREY_COIN_BURN',
      at,
      {
        ...US_BASE,
        actionType: classified('BURN_SUNREY_COIN', 'SYNTHETIC_FACT'),
        productId: classified('prod_digital_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_information_market_request',
      'Information-market research request — disabled, RESEARCH_REQUIRED',
      'INFORMATION_MARKET_REQUEST',
      at,
      {
        ...US_BASE,
        actionType: classified('POST_DEPOSIT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_research_participation',
      'Research participation product — disabled, RESEARCH_REQUIRED',
      'RESEARCH_PARTICIPATION',
      at,
      {
        ...US_BASE,
        actionType: classified('POST_DEPOSIT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_compute_to_data',
      'Compute-to-data marketplace product — disabled, RESEARCH_REQUIRED',
      'COMPUTE_TO_DATA',
      at,
      {
        ...US_BASE,
        actionType: classified('POST_DEPOSIT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_attestation_product',
      'Attestation product — disabled, RESEARCH_REQUIRED',
      'ATTESTATION_PRODUCT',
      at,
      {
        ...US_BASE,
        actionType: classified('POST_DEPOSIT', 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
    scenario(
      'rsc_information_compensation',
      'Information-market compensation — disabled, RESEARCH_REQUIRED',
      'INFORMATION_COMPENSATION',
      at,
      {
        ...US_BASE,
        actionType: classified('TRANSFER_SUNREY_COIN', 'SYNTHETIC_FACT'),
        productId: classified('prod_digital_usd_gb', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_uk_ltd', 'SYNTHETIC_FACT'),
        jurisdiction: classified('GB', 'SYNTHETIC_FACT'),
      },
    ),
  ];

  const byCategory = new Map<ScenarioCategory, string[]>();
  for (const row of scenarios) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row.scenarioId);
    byCategory.set(row.category, list);
  }
  const suites: RegulatoryScenarioSuite[] = [...byCategory.entries()].map(([category, ids]) =>
    Object.freeze({
      suiteId: asRegulatoryScenarioSuiteId(`rss_${category.toLowerCase()}`),
      name: category,
      category,
      scenarioIds: Object.freeze(ids) as readonly ReturnType<typeof asRegulatoryScenarioId>[],
      invariant: category === 'INVARIANT_CONTROL',
      createdAt: at,
    }),
  );
  return Object.freeze({
    suites: Object.freeze(suites),
    scenarios: Object.freeze(scenarios),
  });
}

export function suiteIdFor(category: ScenarioCategory): RegulatoryScenarioSuiteId {
  return asRegulatoryScenarioSuiteId(`rss_${category.toLowerCase()}`);
}
