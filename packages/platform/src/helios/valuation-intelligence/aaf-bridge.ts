/**
 * AAF V2 universal feature fabric binding for valuation feature consumption.
 */

import { FUNDAMENTAL_UNIVERSAL_COMPILER_VERSION } from '../feature-fabric/universal/fundamental-bridge.ts';
import type { AafV2FeatureFabricBinding } from './input-manifest.ts';

export const VAL01_AAF_V2_MANDATORY = true as const;

export function bindAafV2UniversalManifest(input: {
  readonly manifestRef: string;
  readonly evaluationTime: import('@solstice/domain').UtcInstant;
  readonly knowableAt: import('@solstice/domain').UtcInstant;
}): AafV2FeatureFabricBinding {
  return Object.freeze({
    source: 'aaf_v2_universal_feature_fabric',
    manifestRef: input.manifestRef,
    compilerVersion: FUNDAMENTAL_UNIVERSAL_COMPILER_VERSION,
    evaluationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    grantsExecutionAuthority: false,
  });
}

export type Val01AafV2Binding = {
  readonly mandatory: typeof VAL01_AAF_V2_MANDATORY;
  readonly fabric: AafV2FeatureFabricBinding;
  readonly grantsExecutionAuthority: false;
};

export function bindVal01ToAafV2(fabric: AafV2FeatureFabricBinding): Val01AafV2Binding {
  return Object.freeze({
    mandatory: VAL01_AAF_V2_MANDATORY,
    fabric,
    grantsExecutionAuthority: false,
  });
}
