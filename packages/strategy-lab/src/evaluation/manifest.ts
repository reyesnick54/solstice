import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CorporateActionFixture, MarketDataset, UniverseMembership } from '../dataset.ts';
import { freezeMarketDataset } from '../dataset.ts';
import type { StrategyFailure } from '../types.ts';
import { buildInformationTimeFields, type InformationTimeFields } from './information-time.ts';
import { asEvaluationDatasetManifestId, type EvaluationDatasetManifestId } from './ids.ts';
import type { EvaluationLimitation, FeedEntitlementClass } from './types.ts';

export type ChronologicalObservation = {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly informationTime: InformationTimeFields;
  readonly providerId: string;
  readonly providerSequence: number;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly available: boolean;
  readonly sessionOpen: boolean;
  readonly degraded: boolean;
  readonly corporateActionVersion: string | null;
};

export type DegradedPeriod = {
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly reason: string;
};

export type EvaluationDatasetManifest = {
  readonly manifestId: EvaluationDatasetManifestId;
  readonly version: string;
  readonly instruments: readonly string[];
  readonly membership: readonly UniverseMembership[];
  readonly timeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly providerIds: readonly string[];
  readonly datasetIds: readonly string[];
  readonly observationCount: number;
  readonly availabilityTimeSemantics: 'H08_KNOWABLE_AT';
  readonly corporateActionHandling: MarketDataset['corporateActionHandling'];
  readonly corporateActionVersion: string | null;
  readonly degradedPeriods: readonly DegradedPeriod[];
  readonly feedEntitlement: FeedEntitlementClass;
  readonly gapsExplicit: readonly DegradedPeriod[];
  readonly limitations: readonly string[];
  readonly observations: readonly ChronologicalObservation[];
  readonly corporateActions: readonly CorporateActionFixture[];
  readonly hash: string;
  readonly liveMarketData: false;
};

function canonicalManifest(
  input: Omit<EvaluationDatasetManifest, 'hash' | 'liveMarketData' | 'manifestId' | 'observationCount'>,
): string {
  return JSON.stringify(
    {
      ...input,
      observations: input.observations.map((row) => ({
        ...row,
        openMinor: row.openMinor.toString(),
        highMinor: row.highMinor.toString(),
        lowMinor: row.lowMinor.toString(),
        closeMinor: row.closeMinor.toString(),
        bidMinor: row.bidMinor?.toString() ?? null,
        askMinor: row.askMinor?.toString() ?? null,
      })),
      corporateActions: input.corporateActions.map((row) => ({
        ...row,
        cashMinorPerShare: row.cashMinorPerShare?.toString() ?? null,
        splitNumerator: row.splitNumerator?.toString() ?? null,
        splitDenominator: row.splitDenominator?.toString() ?? null,
      })),
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
}

export function buildChronologicalObservation(input: {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly sourceEventTime: UtcInstant;
  readonly sourcePublishedTime?: UtcInstant | null;
  readonly providerAvailabilityTime?: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime: UtcInstant;
  readonly providerId: string;
  readonly providerSequence: number;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly bidMinor?: bigint | null;
  readonly askMinor?: bigint | null;
  readonly available?: boolean;
  readonly sessionOpen?: boolean;
  readonly degraded?: boolean;
  readonly corporateActionVersion?: string | null;
}): ChronologicalObservation {
  return Object.freeze({
    observationId: input.observationId,
    instrumentId: input.instrumentId,
    informationTime: buildInformationTimeFields({
      sourceEventTime: input.sourceEventTime,
      sourcePublishedTime: input.sourcePublishedTime,
      providerAvailabilityTime: input.providerAvailabilityTime,
      sunreyArrivalTime: input.sunreyArrivalTime,
      ingestionTime: input.ingestionTime,
    }),
    providerId: input.providerId,
    providerSequence: input.providerSequence,
    openMinor: input.openMinor,
    highMinor: input.highMinor,
    lowMinor: input.lowMinor,
    closeMinor: input.closeMinor,
    bidMinor: input.bidMinor ?? null,
    askMinor: input.askMinor ?? null,
    available: input.available ?? true,
    sessionOpen: input.sessionOpen ?? true,
    degraded: input.degraded ?? false,
    corporateActionVersion: input.corporateActionVersion ?? null,
  });
}

export function freezeEvaluationDatasetManifest(
  input: Omit<
    EvaluationDatasetManifest,
    'hash' | 'liveMarketData' | 'manifestId' | 'observationCount' | 'availabilityTimeSemantics'
  > & {
    readonly manifestId?: EvaluationDatasetManifestId;
  },
): Result<EvaluationDatasetManifest, StrategyFailure> {
  if (input.version.length === 0) {
    return err({ code: 'UNVERSIONED_DATASET', message: 'dataset manifest version is required' });
  }
  const hash = createHash('sha256').update(canonicalManifest(input)).digest('hex');
  return ok(
    Object.freeze({
      ...input,
      manifestId: input.manifestId ?? asEvaluationDatasetManifestId(`edmf_${hash.slice(0, 20)}`),
      observationCount: input.observations.length,
      availabilityTimeSemantics: 'H08_KNOWABLE_AT' as const,
      instruments: Object.freeze([...input.instruments]),
      membership: Object.freeze([...input.membership]),
      providerIds: Object.freeze([...input.providerIds]),
      datasetIds: Object.freeze([...input.datasetIds]),
      degradedPeriods: Object.freeze([...input.degradedPeriods]),
      gapsExplicit: Object.freeze([...input.gapsExplicit]),
      limitations: Object.freeze([...input.limitations]),
      observations: Object.freeze([...input.observations]),
      corporateActions: Object.freeze([...input.corporateActions]),
      hash,
      liveMarketData: false,
    }),
  );
}

/** Build a point-in-time MarketDataset view eligible at decisionTime (information-time gated). */
export function manifestViewAt(
  manifest: EvaluationDatasetManifest,
  decisionTime: UtcInstant,
): Result<MarketDataset, StrategyFailure | EvaluationLimitation> {
  const eligible = manifest.observations.filter((row) => row.informationTime.knowableAt <= decisionTime);
  const frozen = freezeMarketDataset({
    version: manifest.version as MarketDataset['version'],
    instruments: manifest.instruments,
    membership: manifest.membership,
    timeRange: manifest.timeRange,
    frequency: 'DAILY',
    source: 'SYNTHETIC_FIXTURE',
    provenance: `manifest:${manifest.manifestId}@${manifest.version}`,
    currency: 'USD',
    corporateActionHandling: manifest.corporateActionHandling,
    completeness: manifest.gapsExplicit.length > 0 ? 'GAPPED' : 'COMPLETE_FOR_FIXTURE',
    limitations: Object.freeze([
      ...manifest.limitations,
      `Information-time view at ${decisionTime}; ${eligible.length}/${manifest.observationCount} observations eligible.`,
    ]),
    observations: Object.freeze(
      eligible.map((row) =>
        Object.freeze({
          instrumentId: row.instrumentId,
          at: row.informationTime.sourceEventTime,
          openMinor: row.openMinor,
          highMinor: row.highMinor,
          lowMinor: row.lowMinor,
          closeMinor: row.closeMinor,
          available: row.available && row.sessionOpen && !row.degraded,
        }),
      ),
    ),
    corporateActions: Object.freeze(
      manifest.corporateActions.filter((row) => row.at <= decisionTime),
    ),
  });
  if (!frozen.ok) {
    return frozen;
  }
  return ok(frozen.value);
}

export function manifestLimitations(manifest: EvaluationDatasetManifest): readonly EvaluationLimitation[] {
  const out: EvaluationLimitation[] = [];
  if (manifest.observations.some((row) => row.bidMinor === null || row.askMinor === null)) {
    out.push(
      Object.freeze({
        code: 'NO_ORDER_BOOK_DEPTH',
        message: 'Bid/ask unavailable for some observations; close-based fallback is not used when bid/ask missing.',
      }),
    );
  }
  if (manifest.membership.length === 0) {
    out.push(
      Object.freeze({
        code: 'NO_HISTORICAL_UNIVERSE',
        message: 'Historical universe membership data is not available; survivorship limitation applies.',
      }),
    );
  }
  for (const gap of manifest.gapsExplicit) {
    out.push(
      Object.freeze({
        code: 'EXPLICIT_DATA_GAP',
        message: `Missing data ${gap.start}..${gap.end}: ${gap.reason}`,
      }),
    );
  }
  return Object.freeze(out);
}
