/**
 * ALPHA24 — recurring daily and weekly shadow evidence reports.
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha24`.
 */

export const HELIOS_ALPHA24_RECURRING_EVIDENCE_REPORTS = 'HELIOS_ALPHA24_RECURRING_EVIDENCE_REPORTS' as const;

export {
  runAlpha24ForwardResearchBookPipeline,
  evaluateAlpha24ResearchBookQualification,
  HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED,
} from '../forward-alpha/alpha24/index.ts';
