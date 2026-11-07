import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA } from './taxonomy.ts';
import type { GeospatialActivityManifest, GeospatialActivityStoreSnapshot } from './types.ts';
import { assertNoGeospatialLeakage, filterKnowableGeoObservations } from './knowable-at.ts';

export function compileGeospatialActivityManifest(input: {
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly snapshot: GeospatialActivityStoreSnapshot;
}): GeospatialActivityManifest {
  assertNoGeospatialLeakage(input.evaluationTime, input.snapshot.observations);
  const observations = filterKnowableGeoObservations(
    input.evaluationTime,
    input.snapshot.observations,
  );
  const estimates = input.snapshot.estimates.filter((row) => row.evaluationTime <= input.evaluationTime);
  return Object.freeze({
    schema: HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA,
    evaluationTime: input.evaluationTime,
    compiledAt: input.compiledAt,
    assets: input.snapshot.assets,
    observations,
    estimates: Object.freeze(estimates),
    grantsExecutionAuthority: false,
  });
}
