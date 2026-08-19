import { identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';
import type { AgricultureSourceRecord } from './types.ts';

/**
 * Canonical harvest identity references. Multiple systems may observe
 * the same farm / field / crop cycle / campaign / batch / lot.
 */
export type HarvestIdentityBundle = {
  readonly farmSiteRef: IdentityRef;
  readonly fieldPlotRef: IdentityRef | null;
  readonly cropCycleRef: IdentityRef | null;
  readonly harvestCampaignRef: IdentityRef | null;
  readonly harvestBatchRef: IdentityRef | null;
  readonly lotRef: IdentityRef | null;
  readonly siloBatchRef: IdentityRef | null;
  readonly packhouseBatchRef: IdentityRef | null;
};

export function harvestIdentityBundle(record: AgricultureSourceRecord): HarvestIdentityBundle {
  return Object.freeze({
    farmSiteRef: identityRef('farm', record.identity.farmSiteId),
    fieldPlotRef: record.identity.fieldPlotId ? identityRef('field', record.identity.fieldPlotId) : null,
    cropCycleRef: record.identity.cropCycleId ? identityRef('cycle', record.identity.cropCycleId) : null,
    harvestCampaignRef: record.identity.harvestCampaignId
      ? identityRef('campaign', record.identity.harvestCampaignId)
      : null,
    harvestBatchRef: record.identity.harvestBatchId ? identityRef('batch', record.identity.harvestBatchId) : null,
    lotRef: record.identity.lotId ? identityRef('lot', record.identity.lotId) : null,
    siloBatchRef: record.identity.siloBatchId ? identityRef('silo', record.identity.siloBatchId) : null,
    packhouseBatchRef: record.identity.packhouseBatchId
      ? identityRef('packhouse', record.identity.packhouseBatchId)
      : null,
  });
}

export function sameHarvestIdentity(left: HarvestIdentityBundle, right: HarvestIdentityBundle): boolean {
  return (
    left.farmSiteRef === right.farmSiteRef &&
    (left.harvestBatchRef !== null && left.harvestBatchRef === right.harvestBatchRef ||
      left.lotRef !== null && left.lotRef === right.lotRef ||
      left.cropCycleRef !== null &&
        left.cropCycleRef === right.cropCycleRef &&
        left.harvestCampaignRef !== null &&
        left.harvestCampaignRef === right.harvestCampaignRef)
  );
}
