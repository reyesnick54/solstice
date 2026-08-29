export const TURO_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'turo',
  integrationMode: 'PARTNER_APPROVAL_REQUIRED',
  canonicalUnits: Object.freeze(['VEHICLE_DAY', 'VEHICLE_HOUR']),
  liveConnectivity: false,
  notes: 'Vehicle capacity through canonical vehicle-day/hour units; production booking requires partner approval.',
});
