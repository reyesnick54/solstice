/**
 * ACCESS-02 structural isolation for the Human Access Economy bounded context.
 *
 * Access economy models governed rights and entitlements. It is not settlement,
 * valuation, productive capacity authority, minting authority, or Exchange pricing.
 */

export const ACCESS_ECONOMY_ISOLATION = Object.freeze({
  boundedContextId: 'ACCESS_ECONOMY',
  capability: 'sunrey-access-economy-domain',
  pricingImplemented: false,
  reservationExecutionImplemented: false,
  exchangeIntegrationImplemented: false,
  productionActivated: false,
  issuesExecutionAuthority: false,
  authorizesLedgerPosting: false,
  authorizesMinting: false,
  authorizesSettlement: false,
  mustNotImport: Object.freeze([
    'packages/kernel',
    'packages/ledger',
    'packages/permissions',
    'packages/platform',
    'packages/sunrey-exchange',
    'services/accounts',
    'services/api',
  ]),
  forbiddenCompetingPackages: Object.freeze([
    'packages/access-fabric',
    'packages/access-v2',
    'packages/licensing',
    'packages/reservation-engine',
    'packages/access-market',
  ]),
  composesWith: Object.freeze([
    'packages/economic-asset-registry',
    'packages/consent',
    'packages/personal-data-vault',
    'packages/information-market',
  ]),
});
