/**
 * ACCESS-18 BFF projections for human information to access surfaces.
 */

import type {
  CompensationHistoryEntry,
  ConsentStatusView,
  DataOpportunityView,
  ParticipationHistoryEntry,
} from '../../access-economy/src/hin-access/types.ts';
import type { HumanInformationAccessBridge } from '../../access-economy/src/hin-access/engine.ts';
import type { SubjectRef } from '../ids.ts';

export type DataOpportunityBffView = Readonly<{
  readonly schema: 'sunrey.consumer.data.opportunity.v1';
  readonly opportunityId: string;
  readonly requesterLabel: string;
  readonly informationRequested: string;
  readonly purpose: string;
  readonly permittedPurposeRef: string;
  readonly compensationPath: string;
  readonly compensationAmountMinor: string;
  readonly compensationAsset: string;
  readonly expiresAt: string;
  readonly revocationRules: string;
  readonly status: string;
  readonly rawPdvExposed: false;
}>;

export type ParticipationHistoryBffView = Readonly<{
  readonly schema: 'sunrey.consumer.data.participation.history.v1';
  readonly items: readonly Readonly<{
    readonly eventId: string;
    readonly opportunityId: string;
    readonly action: string;
    readonly occurredAt: string;
    readonly contributionId: string | null;
    readonly dataUsedForAccessWeighting: false;
  }>[];
}>;

export type CompensationHistoryBffView = Readonly<{
  readonly schema: 'sunrey.consumer.data.compensation.history.v1';
  readonly items: readonly Readonly<{
    readonly settlementId: string;
    readonly opportunityId: string;
    readonly amountMinor: string;
    readonly asset: string;
    readonly compensationPath: string;
    readonly settledAt: string;
    readonly minted: false;
  }>[];
}>;

export type ConsentStatusBffView = Readonly<{
  readonly schema: 'sunrey.consumer.data.consent.status.v1';
  readonly activeConsents: number;
  readonly revokedConsents: number;
  readonly participationEligible: boolean;
  readonly rawPdvExposed: false;
}>;

function projectOpportunity(row: DataOpportunityView): DataOpportunityBffView {
  return Object.freeze({
    schema: 'sunrey.consumer.data.opportunity.v1',
    opportunityId: row.opportunityId,
    requesterLabel: row.requesterLabel,
    informationRequested: row.informationRequested,
    purpose: row.purpose,
    permittedPurposeRef: row.permittedPurposeRef,
    compensationPath: row.compensationPath,
    compensationAmountMinor: row.compensationAmountMinor.toString(),
    compensationAsset: row.compensationAsset,
    expiresAt: row.expiresAt,
    revocationRules: row.revocationRules,
    status: row.status,
    rawPdvExposed: false,
  });
}

function projectParticipation(rows: readonly ParticipationHistoryEntry[]): ParticipationHistoryBffView {
  return Object.freeze({
    schema: 'sunrey.consumer.data.participation.history.v1',
    items: Object.freeze(
      rows.map((row) =>
        Object.freeze({
          eventId: row.eventId,
          opportunityId: row.opportunityId,
          action: row.action,
          occurredAt: row.occurredAt,
          contributionId: row.contributionId,
          dataUsedForAccessWeighting: false as const,
        }),
      ),
    ),
  });
}

function projectCompensation(rows: readonly CompensationHistoryEntry[]): CompensationHistoryBffView {
  return Object.freeze({
    schema: 'sunrey.consumer.data.compensation.history.v1',
    items: Object.freeze(
      rows.map((row) =>
        Object.freeze({
          settlementId: row.settlementId,
          opportunityId: row.opportunityId,
          amountMinor: row.amountMinor.toString(),
          asset: row.asset,
          compensationPath: row.compensationPath,
          settledAt: row.settledAt,
          minted: false as const,
        }),
      ),
    ),
  });
}

function projectConsent(row: ConsentStatusView): ConsentStatusBffView {
  return Object.freeze({
    schema: 'sunrey.consumer.data.consent.status.v1',
    activeConsents: row.activeConsents,
    revokedConsents: row.revokedConsents,
    participationEligible: row.participationEligible,
    rawPdvExposed: false,
  });
}

export type HinAccessBffSurface = Readonly<{
  readonly listOpportunities: () => readonly DataOpportunityBffView[];
  readonly getOpportunity: (opportunityId: string) => DataOpportunityBffView | { readonly error: 'NOT_FOUND' };
  readonly participationHistory: (subjectRef: SubjectRef) => ParticipationHistoryBffView;
  readonly compensationHistory: (subjectRef: SubjectRef) => CompensationHistoryBffView;
  readonly consentStatus: (subjectRef: SubjectRef) => ConsentStatusBffView;
}>;

export type { HumanInformationAccessBridge } from '../../access-economy/src/hin-access/engine.ts';
export { subjectRefFor } from '../../access-economy/src/ids.ts';

export function createHinAccessBffSurface(bridge: HumanInformationAccessBridge): HinAccessBffSurface {
  return Object.freeze({
    listOpportunities() {
      return Object.freeze(bridge.listOpportunities().map(projectOpportunity));
    },
    getOpportunity(opportunityId: string) {
      const row = bridge.getOpportunity(opportunityId as DataOpportunityView['opportunityId']);
      return row ? projectOpportunity(row) : { error: 'NOT_FOUND' as const };
    },
    participationHistory(subjectRef: SubjectRef) {
      return projectParticipation(bridge.participationHistory(subjectRef));
    },
    compensationHistory(subjectRef: SubjectRef) {
      return projectCompensation(bridge.compensationHistory(subjectRef));
    },
    consentStatus(subjectRef: SubjectRef) {
      return projectConsent(bridge.consentStatus(subjectRef));
    },
  });
}
