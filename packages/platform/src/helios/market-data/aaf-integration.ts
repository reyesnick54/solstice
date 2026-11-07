import type { UtcInstant } from '@solstice/domain';

import {
  AAF_FEATURE_CERTIFICATION_BLOCK_STATES,
  type AafFeatureCertificationBlockState,
} from './taxonomy.ts';

/** Minimum metadata every research feature must receive from market-data observations. */
export type MarketDataAafFeatureEnvelope = {
  readonly eventTime: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly providerLineageRef: string;
  readonly sequenceIntegrity: 'INTACT' | 'GAP_RECOVERED' | 'DESYNCHRONIZED';
  readonly qualityState: string;
  readonly entitlementState: string;
  readonly syncState: AafFeatureCertificationBlockState | 'TRUSTED';
};

export function aafSyncStateFromInputs(input: {
  readonly sequenceIntegrity: MarketDataAafFeatureEnvelope['sequenceIntegrity'];
  readonly qualityState: string;
  readonly entitlementState: string;
}): AafFeatureCertificationBlockState | 'TRUSTED' {
  if (input.sequenceIntegrity === 'DESYNCHRONIZED') {
    return 'DESYNCHRONIZED';
  }
  if (input.entitlementState === 'BLOCKED' || input.entitlementState === 'ENTITLEMENT_BLOCKED') {
    return 'ENTITLEMENT_BLOCKED';
  }
  if (input.qualityState === 'UNTRUSTED' || input.qualityState.startsWith('DEGRADED_UNTRUSTED')) {
    return 'UNTRUSTED';
  }
  return 'TRUSTED';
}

export function mayAafCertifyMarketDataFeature(envelope: MarketDataAafFeatureEnvelope): boolean {
  const sync = aafSyncStateFromInputs({
    sequenceIntegrity: envelope.sequenceIntegrity,
    qualityState: envelope.qualityState,
    entitlementState: envelope.entitlementState,
  });
  if (sync !== 'TRUSTED' && (AAF_FEATURE_CERTIFICATION_BLOCK_STATES as readonly string[]).includes(sync)) {
    return false;
  }
  if (envelope.eventTime === null) {
    return false;
  }
  if (!envelope.providerLineageRef.trim()) {
    return false;
  }
  if (envelope.knowableAt < envelope.eventTime) {
    return false;
  }
  return true;
}

export function assertMarketDataFeatureEnvelopeComplete(
  envelope: MarketDataAafFeatureEnvelope,
): void {
  if (envelope.eventTime === null) {
    throw new Error('market-data feature missing eventTime');
  }
  if (!envelope.knowableAt) {
    throw new Error('market-data feature missing knowableAt');
  }
  if (!envelope.providerLineageRef.trim()) {
    throw new Error('market-data feature missing provider lineage');
  }
}
