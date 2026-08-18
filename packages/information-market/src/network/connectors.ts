import { newConnectorId, type InformationConnectorId } from './ids.ts';
import type { InformationCategory, InformationSensitivityClass } from './taxonomy.ts';
import type { InformationConnector } from './types.ts';

export function createAuthorizedConnector(input: {
  readonly schema: string;
  readonly dataClasses: readonly InformationCategory[];
  readonly collectionAuthority: string;
  readonly subjectMapping: string;
  readonly freshness: string;
  readonly revocationImplications: string;
  readonly privacyClassification: InformationSensitivityClass;
  readonly connectorId?: InformationConnectorId;
}): InformationConnector {
  return Object.freeze({
    connectorId: input.connectorId ?? newConnectorId(),
    schema: input.schema,
    dataClasses: Object.freeze([...input.dataClasses]),
    collectionAuthority: input.collectionAuthority,
    subjectMapping: input.subjectMapping,
    freshness: input.freshness,
    revocationImplications: input.revocationImplications,
    privacyClassification: input.privacyClassification,
    scraping: false,
    authorizedSourceRelationship: true,
  });
}

export function refuseUncontrolledScraping(): { readonly code: 'SCRAPING_FORBIDDEN'; readonly message: string } {
  return {
    code: 'SCRAPING_FORBIDDEN',
    message: 'uncontrolled collection or scraping of personal information is not a network source',
  };
}
