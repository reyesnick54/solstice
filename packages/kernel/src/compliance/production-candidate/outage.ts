import type { OutagePosture } from '../types.ts';

export type ProviderOutageDisposition =
  | 'TEMPORARILY_UNAVAILABLE'
  | 'REQUIRES_REVIEW'
  | 'BLOCK';

export function dispositionForOutage(input: {
  readonly required: boolean;
  readonly posture: OutagePosture;
}): ProviderOutageDisposition {
  if (!input.required) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  if (input.posture === 'BLOCK') {
    return 'BLOCK';
  }
  if (input.posture === 'REQUIRE_MANUAL_REVIEW') {
    return 'REQUIRES_REVIEW';
  }
  return 'TEMPORARILY_UNAVAILABLE';
}

export function outageMayAutoAllow(): false {
  return false;
}
