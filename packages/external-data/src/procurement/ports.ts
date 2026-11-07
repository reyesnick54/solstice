/**
 * HELIOS ALT10 — provider-neutral procurement ingestion ports (simulation adapters only).
 */

import type { UtcInstant } from '@solstice/domain';

import type { ProcurementExternalObservation } from './types.ts';

export type FederalProcurementApiPort = {
  readonly fetchAwards: (input: {
    readonly attributionEntityId?: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly ProcurementExternalObservation[]>;
};

export type OfficialAwardPublicationPort = {
  readonly fetchPublications: (input: {
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly ProcurementExternalObservation[]>;
};

export type PublicTenderSystemPort = {
  readonly fetchNotices: (input: {
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly ProcurementExternalObservation[]>;
};

export type OfficialContractNoticePort = {
  readonly fetchContractNotices: (input: {
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly ProcurementExternalObservation[]>;
};

export type ProcurementDataPorts = {
  readonly federalProcurementApi?: FederalProcurementApiPort;
  readonly officialAwardPublication?: OfficialAwardPublicationPort;
  readonly publicTenderSystem?: PublicTenderSystemPort;
  readonly officialContractNotice?: OfficialContractNoticePort;
};
