export const EXPECTED_PROVIDER_COUNT: 126;
export const CATALOG_PATH: string;
export const SCHEMA_PATH: string;
export const CATEGORIES: readonly string[];
export const AUTHORITY_CLASSES: readonly string[];
export const PRIORITIES: readonly string[];
export const LAUNCH_TIERS: readonly string[];
export const VERIFICATION_STATUSES: readonly string[];
export const FREE_ACCESS_STATUSES: readonly string[];
export const COMMERCIAL_USE_STATUSES: readonly string[];
export const REDISTRIBUTION_STATUSES: readonly string[];
export const AUTHENTICATION_TYPES: readonly string[];
export const SUNREY_DOMAINS: readonly string[];
export const FRESHNESS_VALUES: readonly (string | null)[];
export const POPULATION_STATUSES: readonly string[];

export interface CatalogValidationStats {
  total: number;
  expected: number;
  byCategory: Record<string, number>;
  byVerification: Record<string, number>;
  byLaunchTier: Record<string, number>;
  byPriority: Record<string, number>;
  authRequired: number;
  noAuth: number;
  commercialVerified: number;
  commercialUnclear: number;
  legalReview: number;
}

export interface CatalogValidationResult {
  ok: boolean;
  errors: string[];
  stats: CatalogValidationStats | null;
  populationComplete?: boolean;
  awaitingMasterList?: boolean;
}

export function validateCatalog(catalog: unknown): CatalogValidationResult;
export function computeCatalogStats(catalog: unknown): CatalogValidationStats;
export function loadCatalog(root?: string): { catalog: unknown; text: string };
export function formatValidationReport(result: CatalogValidationResult): string;
