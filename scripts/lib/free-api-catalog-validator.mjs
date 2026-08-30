/**
 * SunRey Free API Provider Catalog validator.
 *
 * Validates config/providers/free-api-catalog.yaml against the catalog schema
 * and SunRey provider governance rules. Never permits secrets in catalog files.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const EXPECTED_PROVIDER_COUNT = 126;

export const CATALOG_PATH = 'config/providers/free-api-catalog.yaml';
export const SCHEMA_PATH = 'config/providers/free-api-catalog.schema.json';

export const CATEGORIES = [
  'macroeconomics',
  'foreign_exchange',
  'markets',
  'securities',
  'commodities',
  'corporate_filings',
  'cryptocurrency',
  'blockchain',
  'compliance',
  'kyb_identity',
  'fraud_risk',
  'cybersecurity',
  'energy',
  'natural_resources',
  'environmental',
  'weather',
  'water',
  'transportation',
  'aviation',
  'maritime',
  'travel',
  'geospatial',
  'logistics',
  'health',
  'food_nutrition',
  'jobs_skills',
  'research',
  'patents',
  'government_open_data',
  'artificial_intelligence',
  'other',
];

export const AUTHORITY_CLASSES = [
  'authoritative_official',
  'regulated_provider',
  'reference_data',
  'research_data',
  'community_data',
  'derived_data',
];

export const PRIORITIES = ['critical', 'high', 'medium', 'low'];

export const LAUNCH_TIERS = [
  'production_candidate',
  'secondary_source',
  'fallback_source',
  'research_only',
  'blocked_pending_review',
];

export const VERIFICATION_STATUSES = [
  'verified',
  'partially_verified',
  'unverified',
  'deprecated',
  'unavailable',
];

export const FREE_ACCESS_STATUSES = [
  'verified_free',
  'free_tier',
  'trial_only',
  'unclear',
  'no_longer_free',
];

export const COMMERCIAL_USE_STATUSES = [
  'verified_allowed',
  'restricted',
  'attribution_required',
  'noncommercial_only',
  'unclear',
  'unknown',
  'requires_legal_review',
];

export const REDISTRIBUTION_STATUSES = [
  'allowed',
  'attribution_required',
  'restricted',
  'prohibited',
  'unclear',
  'unknown',
];

export const AUTHENTICATION_TYPES = [
  'none',
  'api_key',
  'oauth',
  'bearer_token',
  'basic_auth',
  'other',
];

export const SUNREY_DOMAINS = [
  'world',
  'grow',
  'financial_agent',
  'exchange',
  'blockchain_intelligence',
  'moonrey',
  'hin',
  'vault',
  'travel',
  'compliance',
  'cybersecurity',
  'economic_graph',
  'action_center',
  'research',
  'infrastructure',
];

export const FRESHNESS_VALUES = [
  'realtime',
  'delayed',
  'daily',
  'weekly',
  'monthly',
  'historical',
  null,
];

export const POPULATION_STATUSES = ['awaiting_master_list', 'populated', 'partial'];

const SECRET_PATTERNS = [
  /\b(sk|pk)_(live|test)_[A-Za-z0-9]{16,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
  /\bapi[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9._-]{16,}/i,
  /\bpassword\s*[:=]\s*['"]?[^\s'"]{8,}/i,
  /\bsecret\s*[:=]\s*['"]?[A-Za-z0-9._-]{12,}/i,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./,
];

const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidUrl(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateEnum(errors, path, value, allowed, label) {
  if (!allowed.includes(value)) {
    pushError(errors, path, `invalid ${label} "${value}"`);
  }
}

function validateRequiredObject(errors, path, value, label) {
  if (!isObject(value)) {
    pushError(errors, path, `missing required ${label} object`);
    return false;
  }
  return true;
}

function scanForSecrets(errors, path, text) {
  if (typeof text !== 'string') return;
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      pushError(errors, path, 'possible secret value detected');
      return;
    }
  }
}

function validateProvider(provider, index, errors) {
  const base = `providers[${index}]`;

  if (!isObject(provider)) {
    pushError(errors, base, 'provider must be an object');
    return;
  }

  const requiredFields = [
    'provider_id',
    'name',
    'short_name',
    'description',
    'primary_category',
    'capabilities',
    'endpoints',
    'authentication',
    'access',
    'commercial_use',
    'redistribution',
    'rate_limits',
    'data_characteristics',
    'sunrey',
    'verification',
  ];

  for (const field of requiredFields) {
    if (!(field in provider)) {
      pushError(errors, `${base}.${field}`, 'required field missing');
    }
  }

  const { provider_id: providerId } = provider;
  if (typeof providerId !== 'string' || !PROVIDER_ID_PATTERN.test(providerId)) {
    pushError(errors, `${base}.provider_id`, 'invalid provider_id format');
  }

  for (const field of ['name', 'short_name', 'description']) {
    if (typeof provider[field] !== 'string' || provider[field].trim().length === 0) {
      pushError(errors, `${base}.${field}`, 'must be a non-empty string');
    }
    scanForSecrets(errors, `${base}.${field}`, provider[field]);
  }

  validateEnum(errors, `${base}.primary_category`, provider.primary_category, CATEGORIES, 'category');

  if (provider.secondary_categories !== undefined) {
    if (!Array.isArray(provider.secondary_categories)) {
      pushError(errors, `${base}.secondary_categories`, 'must be an array');
    } else {
      for (const [i, cat] of provider.secondary_categories.entries()) {
        validateEnum(errors, `${base}.secondary_categories[${i}]`, cat, CATEGORIES, 'category');
      }
    }
  }

  if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) {
    pushError(errors, `${base}.capabilities`, 'must be a non-empty array');
  }

  if (validateRequiredObject(errors, `${base}.endpoints`, provider.endpoints, 'endpoints')) {
    for (const field of ['base_url', 'documentation_url', 'status_url']) {
      if (!isValidUrl(provider.endpoints[field])) {
        pushError(errors, `${base}.endpoints.${field}`, 'invalid URL');
      }
    }
  }

  if (validateRequiredObject(errors, `${base}.authentication`, provider.authentication, 'authentication')) {
    validateEnum(
      errors,
      `${base}.authentication.type`,
      provider.authentication.type,
      AUTHENTICATION_TYPES,
      'authentication type',
    );
    const envVar = provider.authentication.environment_variable;
    if (envVar !== null && envVar !== undefined) {
      if (typeof envVar !== 'string' || !ENV_VAR_PATTERN.test(envVar)) {
        pushError(errors, `${base}.authentication.environment_variable`, 'invalid environment variable name');
      }
    } else if (provider.authentication.type !== 'none' && provider.authentication.required === true) {
      pushError(
        errors,
        `${base}.authentication.environment_variable`,
        'required for authenticated providers',
      );
    }
    scanForSecrets(errors, `${base}.authentication`, JSON.stringify(provider.authentication));
  }

  if (validateRequiredObject(errors, `${base}.access`, provider.access, 'access')) {
    validateEnum(errors, `${base}.access.status`, provider.access.status, FREE_ACCESS_STATUSES, 'free access status');
  }

  if (validateRequiredObject(errors, `${base}.commercial_use`, provider.commercial_use, 'commercial_use')) {
    validateEnum(
      errors,
      `${base}.commercial_use.status`,
      provider.commercial_use.status,
      COMMERCIAL_USE_STATUSES,
      'commercial use status',
    );
  }

  if (validateRequiredObject(errors, `${base}.redistribution`, provider.redistribution, 'redistribution')) {
    validateEnum(
      errors,
      `${base}.redistribution.status`,
      provider.redistribution.status,
      REDISTRIBUTION_STATUSES,
      'redistribution status',
    );
  }

  if (validateRequiredObject(errors, `${base}.sunrey`, provider.sunrey, 'sunrey')) {
    if (!Array.isArray(provider.sunrey.domain) || provider.sunrey.domain.length === 0) {
      pushError(errors, `${base}.sunrey.domain`, 'must be a non-empty array');
    } else {
      for (const [i, domain] of provider.sunrey.domain.entries()) {
        validateEnum(errors, `${base}.sunrey.domain[${i}]`, domain, SUNREY_DOMAINS, 'SunRey domain');
      }
    }
    validateEnum(errors, `${base}.sunrey.priority`, provider.sunrey.priority, PRIORITIES, 'priority');
    validateEnum(errors, `${base}.sunrey.launch_tier`, provider.sunrey.launch_tier, LAUNCH_TIERS, 'launch tier');
    validateEnum(
      errors,
      `${base}.sunrey.authority_class`,
      provider.sunrey.authority_class,
      AUTHORITY_CLASSES,
      'authority class',
    );
  }

  if (validateRequiredObject(errors, `${base}.verification`, provider.verification, 'verification')) {
    validateEnum(
      errors,
      `${base}.verification.status`,
      provider.verification.status,
      VERIFICATION_STATUSES,
      'verification status',
    );
    const lastVerified = provider.verification.last_verified;
    if (lastVerified !== null && lastVerified !== undefined) {
      if (typeof lastVerified !== 'string' || !DATE_PATTERN.test(lastVerified)) {
        pushError(errors, `${base}.verification.last_verified`, 'must be YYYY-MM-DD or null');
      }
    }
  }

  if (validateRequiredObject(errors, `${base}.data_characteristics`, provider.data_characteristics, 'data_characteristics')) {
    const freshness = provider.data_characteristics.freshness;
    if (!FRESHNESS_VALUES.includes(freshness)) {
      pushError(errors, `${base}.data_characteristics.freshness`, 'invalid freshness value');
    }
  }

  scanForSecrets(errors, base, JSON.stringify(provider));
}

export function validateCatalog(catalog) {
  const errors = [];

  if (!isObject(catalog)) {
    return {
      ok: false,
      errors: ['catalog: root must be an object'],
      stats: null,
    };
  }

  if (catalog.schema_version !== '1.0.0') {
    pushError(errors, 'schema_version', 'must be "1.0.0"');
  }
  if (catalog.catalog_id !== 'sunrey-free-api-catalog') {
    pushError(errors, 'catalog_id', 'must be "sunrey-free-api-catalog"');
  }
  if (catalog.expected_provider_count !== EXPECTED_PROVIDER_COUNT) {
    pushError(errors, 'expected_provider_count', `must be ${EXPECTED_PROVIDER_COUNT}`);
  }
  validateEnum(errors, 'population_status', catalog.population_status, POPULATION_STATUSES, 'population status');

  if (!Array.isArray(catalog.providers)) {
    pushError(errors, 'providers', 'must be an array');
    return { ok: false, errors, stats: null };
  }

  const providers = catalog.providers;
  const ids = new Set();
  const names = new Set();

  for (const [index, provider] of providers.entries()) {
    validateProvider(provider, index, errors);
    if (isObject(provider)) {
      if (ids.has(provider.provider_id)) {
        pushError(errors, `providers[${index}].provider_id`, 'duplicate provider_id');
      } else {
        ids.add(provider.provider_id);
      }
      const normalizedName = typeof provider.name === 'string' ? provider.name.trim().toLowerCase() : '';
      if (normalizedName && names.has(normalizedName)) {
        pushError(errors, `providers[${index}].name`, 'duplicate provider name');
      } else if (normalizedName) {
        names.add(normalizedName);
      }
    }
  }

  if (catalog.population_status === 'populated' && providers.length !== EXPECTED_PROVIDER_COUNT) {
    pushError(
      errors,
      'providers',
      `population_status is populated but provider count is ${providers.length}, expected ${EXPECTED_PROVIDER_COUNT}`,
    );
  }

  scanForSecrets(errors, 'catalog', JSON.stringify(catalog));

  const stats = computeCatalogStats(catalog);

  return {
    ok: errors.length === 0,
    errors,
    stats,
    populationComplete: providers.length === EXPECTED_PROVIDER_COUNT,
    awaitingMasterList: catalog.population_status === 'awaiting_master_list',
  };
}

export function computeCatalogStats(catalog) {
  const providers = Array.isArray(catalog?.providers) ? catalog.providers : [];

  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byVerification = Object.fromEntries(VERIFICATION_STATUSES.map((s) => [s, 0]));
  const byLaunchTier = Object.fromEntries(LAUNCH_TIERS.map((s) => [s, 0]));
  const byPriority = Object.fromEntries(PRIORITIES.map((s) => [s, 0]));

  let authRequired = 0;
  let noAuth = 0;
  let commercialVerified = 0;
  let commercialUnclear = 0;
  let legalReview = 0;

  for (const provider of providers) {
    if (!isObject(provider)) continue;

    const category = provider.primary_category;
    if (typeof category === 'string' && category in byCategory) {
      byCategory[category] += 1;
    }

    const verificationStatus = provider.verification?.status;
    if (typeof verificationStatus === 'string' && verificationStatus in byVerification) {
      byVerification[verificationStatus] += 1;
    }

    const launchTier = provider.sunrey?.launch_tier;
    if (typeof launchTier === 'string' && launchTier in byLaunchTier) {
      byLaunchTier[launchTier] += 1;
    }

    const priority = provider.sunrey?.priority;
    if (typeof priority === 'string' && priority in byPriority) {
      byPriority[priority] += 1;
    }

    const auth = provider.authentication;
    if (auth?.required === true || (auth?.type && auth.type !== 'none')) {
      authRequired += 1;
    } else {
      noAuth += 1;
    }

    const commercial = provider.commercial_use?.status;
    if (commercial === 'verified_allowed') commercialVerified += 1;
    if (commercial === 'unclear' || commercial === 'unknown') commercialUnclear += 1;
    if (commercial === 'requires_legal_review') legalReview += 1;
  }

  return {
    total: providers.length,
    expected: EXPECTED_PROVIDER_COUNT,
    byCategory,
    byVerification,
    byLaunchTier,
    byPriority,
    authRequired,
    noAuth,
    commercialVerified,
    commercialUnclear,
    legalReview,
  };
}

export function loadCatalog(root = ROOT) {
  const catalogAbs = join(root, CATALOG_PATH);
  const text = readFileSync(catalogAbs, 'utf8');
  const catalog = parseYaml(text);
  return { catalog, text };
}

export function formatValidationReport(result) {
  const { stats, ok, errors, populationComplete, awaitingMasterList } = result;
  const lines = [];
  lines.push('SunRey External Provider Catalog');
  lines.push('');
  lines.push(`Total providers: ${stats?.total ?? 0}`);
  lines.push(`Expected providers: ${EXPECTED_PROVIDER_COUNT}`);
  if (awaitingMasterList) {
    lines.push('Population status: awaiting_master_list');
  } else if (populationComplete) {
    lines.push('Population status: complete');
  } else {
    lines.push('Population status: incomplete');
  }
  lines.push('');
  lines.push(`Verified: ${stats?.byVerification?.verified ?? 0}`);
  lines.push(`Partially verified: ${stats?.byVerification?.partially_verified ?? 0}`);
  lines.push(`Unverified: ${stats?.byVerification?.unverified ?? 0}`);
  lines.push(`Deprecated: ${stats?.byVerification?.deprecated ?? 0}`);
  lines.push(`Unavailable: ${stats?.byVerification?.unavailable ?? 0}`);
  lines.push('');
  lines.push(`Production candidates: ${stats?.byLaunchTier?.production_candidate ?? 0}`);
  lines.push(`Secondary sources: ${stats?.byLaunchTier?.secondary_source ?? 0}`);
  lines.push(`Fallback sources: ${stats?.byLaunchTier?.fallback_source ?? 0}`);
  lines.push(`Research only: ${stats?.byLaunchTier?.research_only ?? 0}`);
  lines.push(`Blocked: ${stats?.byLaunchTier?.blocked_pending_review ?? 0}`);
  lines.push('');
  lines.push(`Authentication required: ${stats?.authRequired ?? 0}`);
  lines.push(`No authentication: ${stats?.noAuth ?? 0}`);
  lines.push('');
  lines.push(`Commercial use verified: ${stats?.commercialVerified ?? 0}`);
  lines.push(`Commercial use unclear: ${stats?.commercialUnclear ?? 0}`);
  lines.push(`Legal review required: ${stats?.legalReview ?? 0}`);
  lines.push('');
  lines.push(`Validation: ${ok ? 'PASS' : 'FAIL'}`);
  if (errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of errors) {
      lines.push(`  - ${error}`);
    }
  }
  return lines.join('\n');
}
