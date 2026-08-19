import { PRODUCTIVE_CATEGORIES } from '../types.ts';
import {
  canonicalSourceTaxonomy,
  evaluateTaxonomyCompleteness,
  mappingAuthorizesMoonRey,
  productionIsActive,
  referencePriceCanCreateClaim,
} from './index.ts';

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}

export function formatSourceTaxonomyTable(): string {
  const header = [
    pad('Data Source', 24),
    pad('Fact', 28),
    pad('Productive Category', 26),
    pad('Allowed Unit(s)', 28),
    pad('Claim Type(s)', 16),
    'Attribution Required?',
  ].join('  ');
  const rows = canonicalSourceTaxonomy.all().map((row) =>
    [
      pad(row.dataSourceCategory, 24),
      pad(row.factType, 28),
      pad(row.productiveCategory ?? '—', 26),
      pad(row.allowedSourceUnits.join(', '), 28),
      pad(row.allowedClaimTypes.length === 0 ? '—' : row.allowedClaimTypes.join(', '), 16),
      row.requiresAttributionPolicy ? 'yes' : 'no',
    ].join('  '),
  );
  return ['MoonRey Canonical Source-to-Productive Taxonomy', '', header, ...rows].join('\n');
}

export function runMoonreySourceTaxonomyDemo(): string {
  const completeness = evaluateTaxonomyCompleteness();
  const covered = PRODUCTIVE_CATEGORIES.filter((category) =>
    canonicalSourceTaxonomy.sourcePathExistsFor(category),
  );
  const lines = [
    formatSourceTaxonomyTable(),
    '',
    `Covered ProductiveCategories: ${covered.join(', ')}`,
    `PRODUCTIVE_CATEGORY_GAPS=${completeness.productiveCategoryGaps.length}`,
    `REFERENCE_PRICE_CAN_CREATE_CLAIM=${String(referencePriceCanCreateClaim())}`,
    `MAPPING_AUTHORIZES_MOONREY=${String(mappingAuthorizesMoonRey())}`,
    `PRODUCTION_ACTIVE=${String(productionIsActive())}`,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1]?.includes('source-taxonomy/demo');
if (invoked) {
  console.log(runMoonreySourceTaxonomyDemo());
}
