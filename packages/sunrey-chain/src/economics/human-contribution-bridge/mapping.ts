/**
 * Deterministic contribution-class → HumanEvidencePurposeClass mapping.
 *
 * The mapping itself is not an issuance authorization.
 */

import type { HumanEvidencePurposeClass } from '../types.ts';
import {
  MONETARY_CONTRIBUTION_CLASSES,
  type MonetaryContributionClass,
} from './types.ts';

export const PURPOSE_CLASS_MAPPING_IS_ISSUANCE_AUTHORIZATION = false as const;

const PURPOSE_BY_CLASS: Readonly<Record<MonetaryContributionClass, HumanEvidencePurposeClass>> = {
  INFORMATION_RIGHT_CONTRIBUTION: 'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT',
  COMMUNITY_CONTRIBUTION: 'VERIFIED_COMMUNITY_CONTRIBUTION',
  CREATIVE_CONTRIBUTION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  ENTREPRENEURIAL_CONTRIBUTION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  LABOR_CONTRIBUTION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  RESEARCH_CONTRIBUTION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  GOVERNED_PARTICIPATION_EVENT: 'AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT',
  VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
};

export function isMonetaryContributionClass(value: string): value is MonetaryContributionClass {
  return (MONETARY_CONTRIBUTION_CLASSES as readonly string[]).includes(value);
}

export function mapContributionClassToPurposeClass(
  contributionClass: MonetaryContributionClass,
): HumanEvidencePurposeClass {
  return PURPOSE_BY_CLASS[contributionClass];
}
