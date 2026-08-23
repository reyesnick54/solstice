import type { AccessMode } from './taxonomy.ts';
import type { RightsMarketplaceFailure } from './types.ts';

export function refuseRawDatabaseAccess(): RightsMarketplaceFailure {
  return {
    code: 'RAW_DATABASE_ACCESS_DENIED',
    message: 'licensees never receive general database credentials',
  };
}

export function accessModeForProduct(form: string): AccessMode {
  switch (form) {
    case 'API_QUERY_ACCESS':
      return 'CONTROLLED_API';
    case 'INDIVIDUAL_AUTHORIZED_PACKAGE':
      return 'SECURE_EXPORT';
    case 'HIN_AGGREGATE':
    case 'AGGREGATED_DATASET':
    case 'RESEARCH_COHORT':
      return 'PRIVACY_PRESERVING_AGGREGATE';
    default:
      return 'APPROVED_QUERY';
  }
}

export function describeAccess(mode: AccessMode): string {
  switch (mode) {
    case 'CONTROLLED_API':
      return 'purpose-scoped API queries';
    case 'SECURE_EXPORT':
      return 'approved secure export';
    case 'APPROVED_QUERY':
      return 'approved query system';
    case 'PRIVACY_PRESERVING_AGGREGATE':
      return 'privacy-preserving aggregate output';
  }
}
