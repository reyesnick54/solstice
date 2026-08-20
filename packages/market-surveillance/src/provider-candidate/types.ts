import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SurveillanceAlertKind } from '../taxonomy.ts';

export const REGULATED_SURVEILLANCE_WORKLOAD = 'surveillance_worker' as const;
export const FIXTURE_SURVEILLANCE_PROVIDER_ID = 'fixture-surveillance' as const;

export type ExternalSurveillanceSignal = {
  readonly signalId: string;
  readonly kind: SurveillanceAlertKind;
  readonly marketId: string;
  readonly accountId: string;
  readonly participantId: string;
  readonly observedAt: UtcInstant;
};

export type SurveillanceProviderCandidateProfile = {
  readonly providerId: typeof FIXTURE_SURVEILLANCE_PROVIDER_ID;
  readonly version: string;
  readonly credentialDescriptorRef: string;
  readonly endpointProfileRef: string;
  readonly productionAuthorized: false;
  readonly liveVendorConnected: false;
  readonly isEnforcementAuthority: false;
};

export type SurveillanceIngestResult = {
  readonly signalId: string;
  readonly duplicate: boolean;
  readonly alertCount: number;
  readonly cancelsOrder: false;
  readonly freezesWallet: false;
  readonly seizesBalance: false;
  readonly blocksAccount: false;
};
