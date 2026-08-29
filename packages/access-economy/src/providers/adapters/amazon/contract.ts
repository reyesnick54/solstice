export const AMAZON_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'amazon',
  integrationMode: 'PARTNER_APPROVAL_REQUIRED',
  canonicalUnits: Object.freeze(['DELIVERY_RIGHT', 'OWNERSHIP_PURCHASE', 'CONSUMPTION_RIGHT']),
  liveConnectivity: false,
  notes: 'Distinguishes temporary use, consumption, delivery, and ownership purchase; does not force goods into AccessRight.',
});
