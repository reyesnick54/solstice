/**
 * Expedia Rapid Lodging API path vocabulary.
 *
 * Paths align with the official Rapid OpenAPI v3 lodging specification.
 * Host selection (sandbox vs production) is injected via transport config —
 * no host literals in this module.
 */

export const EXPEDIA_RAPID_API_VERSION = 'v3';

export const EXPEDIA_RAPID_PATHS = Object.freeze({
  PROPERTIES_AVAILABILITY: `/${EXPEDIA_RAPID_API_VERSION}/properties/availability`,
  PROPERTY_ROOM_RATE: `/${EXPEDIA_RAPID_API_VERSION}/properties/{property_id}/rooms/{room_id}/rates/{rate_id}`,
  ITINERARIES: `/${EXPEDIA_RAPID_API_VERSION}/itineraries`,
  ITINERARY: `/${EXPEDIA_RAPID_API_VERSION}/itineraries/{itinerary_id}`,
  ITINERARY_ROOM: `/${EXPEDIA_RAPID_API_VERSION}/itineraries/{itinerary_id}/rooms/{room_id}`,
  REGIONS: `/${EXPEDIA_RAPID_API_VERSION}/regions`,
} as const);

export type ExpediaRapidPath = (typeof EXPEDIA_RAPID_PATHS)[keyof typeof EXPEDIA_RAPID_PATHS];

export const EXPEDIA_SANDBOX_HOST_SUFFIX = 'test.ean.com';
export const EXPEDIA_PRODUCTION_HOST_SUFFIX = 'api.ean.com';

export function expandPath(
  template: string,
  params: Readonly<Record<string, string>>,
): string {
  let path = template;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}
