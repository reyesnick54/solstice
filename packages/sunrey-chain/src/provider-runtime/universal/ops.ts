/**
 * Internal operations read model and BFF feature availability.
 * No customer BFF exposure except safe feature availability.
 */

import type { UniversalProviderRuntime } from './runtime.ts';
import type { BffFeatureKey, FeatureAvailability, OperationsProviderView } from './types.ts';

export function listInternalProviderOps(
  runtime: UniversalProviderRuntime,
): readonly OperationsProviderView[] {
  return runtime.listOperationsViews();
}

export function bffFeatureMap(runtime: UniversalProviderRuntime): {
  readonly payments: FeatureAvailability;
  readonly fx: FeatureAvailability;
  readonly cards: FeatureAvailability;
  readonly investments: FeatureAvailability;
} {
  return Object.freeze({
    payments: runtime.featureAvailability('payments'),
    fx: runtime.featureAvailability('fx'),
    cards: runtime.featureAvailability('cards'),
    investments: runtime.featureAvailability('investments'),
  });
}

export function providerDownFromRuntime(
  runtime: UniversalProviderRuntime,
): Readonly<Record<BffFeatureKey, boolean>> {
  const features = bffFeatureMap(runtime);
  return Object.freeze({
    payments: !features.payments.enabled,
    fx: !features.fx.enabled,
    cards: !features.cards.enabled,
    investments: !features.investments.enabled,
  });
}
