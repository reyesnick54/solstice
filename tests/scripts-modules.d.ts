declare module '../scripts/check-case-collisions.mjs' {
  export type CaseCollision = {
    readonly variants: readonly string[];
  };

  export function findCaseCollisions(paths: readonly string[]): CaseCollision[];
  export function formatCaseCollisionReport(collisions: readonly CaseCollision[]): string;
}

declare module '../scripts/lib/free-api-catalog-validator.mjs' {
  export const AUTHORITY_CLASSES: readonly string[];
  export const CATALOG_PATH: string;
  export const EXPECTED_PROVIDER_COUNT: number;
  export const LAUNCH_TIERS: readonly string[];
  export const PRIORITIES: readonly string[];
  export const SUNREY_DOMAINS: readonly string[];
  export const VERIFICATION_STATUSES: readonly string[];

  export function computeCatalogStats(catalog: unknown): Record<string, unknown>;
  export function validateCatalogDocument(catalog: unknown): { readonly ok: boolean; readonly errors: readonly string[] };
  export function validateProviderEntry(entry: unknown): { readonly ok: boolean; readonly errors: readonly string[] };
}

declare module '../../../../scripts/lib/free-api-catalog-validator.mjs' {
  export const AUTHORITY_CLASSES: readonly string[];
  export const CATALOG_PATH: string;
  export const EXPECTED_PROVIDER_COUNT: number;
  export const LAUNCH_TIERS: readonly string[];
  export const PRIORITIES: readonly string[];
  export const SUNREY_DOMAINS: readonly string[];
  export const VERIFICATION_STATUSES: readonly string[];

  export function computeCatalogStats(catalog: unknown): Record<string, unknown>;
  export function validateCatalogDocument(catalog: unknown): { readonly ok: boolean; readonly errors: readonly string[] };
  export function validateProviderEntry(entry: unknown): { readonly ok: boolean; readonly errors: readonly string[] };
}
