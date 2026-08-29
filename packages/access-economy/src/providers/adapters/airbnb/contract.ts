export const AIRBNB_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'airbnb',
  integrationMode: 'PARTNER_APPROVAL_REQUIRED',
  canonicalUnits: Object.freeze(['OCCUPANCY_NIGHT', 'ROOM_NIGHT']),
  liveConnectivity: false,
  notes: 'Production connectivity requires partner-scoped access; lodging maps to occupancy-night capacity.',
});
