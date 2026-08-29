export const DOORDASH_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'doordash',
  integrationMode: 'PARTNER_APPROVAL_REQUIRED',
  scopes: Object.freeze({
    marketplaceOrdering: false,
    deliveryFulfillment: true,
  }),
  canonicalUnits: Object.freeze(['FOOD_DELIVERY', 'MEAL', 'GROCERY_DELIVERY']),
  liveConnectivity: false,
  notes: 'Marketplace ordering scope is not assumed; food redemption is modeled independently from fulfillment rail.',
});
