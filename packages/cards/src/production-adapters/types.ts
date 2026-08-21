/**
 * Phase D Prompt 2 — card issuer / processor production adapter types.
 * SunRey domain remains provider-independent. Adapters do not post
 * journals or issue Execution Authority. PAN/CVV stay outside this plane.
 */

export const CARD_ADAPTER_FRAMEWORK_ID = 'sunrey-card-provider-adapters' as const;
export const CARD_ADAPTER_FRAMEWORK_VERSION = 'phase-d-02/1' as const;

export const CARD_PROVIDER_LIFECYCLES = [
  'SIMULATED',
  'SANDBOX',
  'CERTIFICATION',
  'PREPRODUCTION',
  'LIMITED_LIVE',
  'PRODUCTION',
] as const;
export type CardProviderLifecycle = (typeof CARD_PROVIDER_LIFECYCLES)[number];

export type CardAdapterFlags = {
  readonly productionAuthorized: false;
  readonly productionCardIssued: false;
  readonly applePayCertified: false;
  readonly googlePayCertified: false;
  readonly pciDssCertified: false;
  readonly adapterCanPostLedger: false;
  readonly adapterCanIssueExecutionAuthority: false;
};

export const CARD_ADAPTER_FLAGS: CardAdapterFlags = Object.freeze({
  productionAuthorized: false,
  productionCardIssued: false,
  applePayCertified: false,
  googlePayCertified: false,
  pciDssCertified: false,
  adapterCanPostLedger: false,
  adapterCanIssueExecutionAuthority: false,
});
