import { hashCanonicalJson, implicitVersionRejected } from './hash.ts';
import type { ExactVersionBinding, ReleaseBillOfMaterials } from './types.ts';
import { LAUNCH_FREEZE_SCHEMA_VERSION } from './types.ts';

export function assembleReleaseBillOfMaterials(
  components: readonly ExactVersionBinding[],
): ReleaseBillOfMaterials {
  const ordered = Object.freeze(
    [...components].sort((left, right) => left.componentId.localeCompare(right.componentId)),
  );
  const implicitVersionsPresent = ordered.some(
    (row) => implicitVersionRejected(row.contentVersion) || implicitVersionRejected(row.schemaVersion),
  );
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    bomHash: hashCanonicalJson({
      domain: 'SUNREY_LAUNCH_FREEZE_BOM_V1',
      components: ordered,
    }),
    components: ordered,
    implicitVersionsPresent,
  });
}
