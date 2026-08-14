import type { LegalEntityCapability, PolicyProductBinding, SourceReference } from './types.ts';

/**
 * Simulation capability and product-binding seed.
 * Live capabilities exist as explicit disabled records. Solstice does not
 * claim banking licenses in any jurisdiction.
 */

export const POLICY_SOURCES: readonly SourceReference[] = [
  Object.freeze({
    sourceId: 'src-engineering-pack-shell',
    kind: 'INTERNAL_RESEARCH_MEMO',
    citation: 'Solstice engineering pack shell — not a legal conclusion',
    notes: 'Presence of this source does not confirm any regulatory rule.',
  }),
  Object.freeze({
    sourceId: 'src-no-live-license',
    kind: 'INTERNAL_RESEARCH_MEMO',
    citation: 'No documented live banking license is on file in this repository',
    notes: 'Live capabilities stay disabled until counsel and licensing exist.',
  }),
];

const SIMULATION_BANKING_ACTIONS = [
  'OPEN_ACCOUNT',
  'POST_DEPOSIT',
  'POST_WITHDRAWAL',
  'INTERNAL_TRANSFER',
  'CREATE_HOLD',
  'RELEASE_HOLD',
  'CAPTURE_HOLD',
  'CANCEL_HOLD',
  'POST_FEE',
  'POST_REVERSAL',
  'POST_INTEREST',
  'INITIATE_PENDING_SETTLEMENT',
  'SETTLE_PENDING',
  'RETURN_PENDING',
] as const;

export const SIMULATION_CAPABILITIES: readonly LegalEntityCapability[] = [
  capability({
    capabilityId: 'cap-gb-sim-deposit-banking',
    legalEntityId: 'le_solstice_uk_ltd',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: [
      'prod_demand_usd_gb',
      'prod_savings_usd_gb',
      'prod_demand_gbp_gb',
      'prod_demand_eur_gb',
      'prod_demand_sar_gb',
      'prod_demand_aed_gb',
      'prod_pending_usd_gb',
    ],
    productTypes: ['DEMAND_DEPOSIT', 'SAVINGS_DEPOSIT', 'PENDING_SETTLEMENT'],
    environment: 'simulation',
    enabled: true,
  }),
  capability({
    capabilityId: 'cap-us-sim-deposit-banking',
    legalEntityId: 'le_solstice_us_inc',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_demand_usd_us'],
    productTypes: ['DEMAND_DEPOSIT'],
    environment: 'simulation',
    enabled: true,
  }),
  capability({
    capabilityId: 'cap-gb-sim-digital-custody',
    legalEntityId: 'le_solstice_uk_ltd',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_digital_usd_gb'],
    productTypes: ['DIGITAL_ASSET_CUSTODY'],
    environment: 'simulation',
    enabled: true,
  }),
  capability({
    capabilityId: 'cap-eu-sim-deposit-banking',
    legalEntityId: 'le_solstice_eu_entity',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_demand_eur_eu'],
    productTypes: ['DEMAND_DEPOSIT'],
    environment: 'simulation',
    enabled: false,
  }),
  capability({
    capabilityId: 'cap-sa-sim-deposit-banking',
    legalEntityId: 'le_solstice_sa_entity',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_demand_sar_sa'],
    productTypes: ['DEMAND_DEPOSIT'],
    environment: 'simulation',
    enabled: false,
  }),
  capability({
    capabilityId: 'cap-ae-sim-deposit-banking',
    legalEntityId: 'le_solstice_ae_entity',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_demand_aed_ae'],
    productTypes: ['DEMAND_DEPOSIT'],
    environment: 'simulation',
    enabled: false,
  }),
  capability({
    capabilityId: 'cap-gb-live-deposit-banking',
    legalEntityId: 'le_solstice_uk_ltd',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: [
      'prod_demand_usd_gb',
      'prod_savings_usd_gb',
      'prod_demand_gbp_gb',
      'prod_demand_eur_gb',
      'prod_demand_sar_gb',
      'prod_demand_aed_gb',
      'prod_pending_usd_gb',
    ],
    productTypes: ['DEMAND_DEPOSIT', 'SAVINGS_DEPOSIT', 'PENDING_SETTLEMENT'],
    environment: 'live',
    enabled: false,
  }),
  capability({
    capabilityId: 'cap-us-live-deposit-banking',
    legalEntityId: 'le_solstice_us_inc',
    actionTypes: [...SIMULATION_BANKING_ACTIONS],
    productIds: ['prod_demand_usd_us'],
    productTypes: ['DEMAND_DEPOSIT'],
    environment: 'live',
    enabled: false,
  }),
];

export const POLICY_PRODUCT_BINDINGS: readonly PolicyProductBinding[] = [
  binding({
    productId: 'prod_demand_usd_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'USD',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_savings_usd_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'USD',
    accountClass: 'SAVINGS_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_digital_usd_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'USD',
    accountClass: 'DIGITAL_ASSET_CUSTODY',
    requiredCapabilityId: 'cap-gb-sim-digital-custody',
  }),
  binding({
    productId: 'prod_demand_usd_us',
    servingLegalEntityId: 'le_solstice_us_inc',
    supportedJurisdictions: ['US'],
    currency: 'USD',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-us-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_eur_eu',
    servingLegalEntityId: 'le_solstice_eu_entity',
    supportedJurisdictions: ['DE', 'FR', 'IE'],
    currency: 'EUR',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-eu-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_sar_sa',
    servingLegalEntityId: 'le_solstice_sa_entity',
    supportedJurisdictions: ['SA'],
    currency: 'SAR',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-sa-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_aed_ae',
    servingLegalEntityId: 'le_solstice_ae_entity',
    supportedJurisdictions: ['AE'],
    currency: 'AED',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-ae-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_gbp_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'GBP',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_eur_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'EUR',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_sar_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'SAR',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_demand_aed_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'AED',
    accountClass: 'DEMAND_DEPOSIT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
  binding({
    productId: 'prod_pending_usd_gb',
    servingLegalEntityId: 'le_solstice_uk_ltd',
    supportedJurisdictions: ['GB'],
    currency: 'USD',
    accountClass: 'PENDING_SETTLEMENT',
    requiredCapabilityId: 'cap-gb-sim-deposit-banking',
  }),
];

function capability(
  row: Omit<LegalEntityCapability, 'legalReviewStatus' | 'sourceReference'>,
): LegalEntityCapability {
  return Object.freeze({
    ...row,
    legalReviewStatus: 'RESEARCH_REQUIRED',
    sourceReference: 'src-no-live-license',
  });
}

function binding(
  row: Omit<PolicyProductBinding, 'offeringMode' | 'disclosureRefs'>,
): PolicyProductBinding {
  return Object.freeze({
    ...row,
    offeringMode: 'SIMULATION',
    disclosureRefs: Object.freeze(['src-engineering-pack-shell']),
  });
}
