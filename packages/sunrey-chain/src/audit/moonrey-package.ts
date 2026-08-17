export const MOONREY_REVIEW_PACKAGE = Object.freeze({
  title: 'MoonRey review package',
  publicProductStatus: 'PLANNED',
  parameterClass: 'development/testnet economic parameters',
  tickers: 'NOT_ASSIGNED',
  lifecycle: {
    claim: 'Verified productive contribution admitted from oracle facts',
    fingerprint: 'contributionFingerprint over object, period epoch, and measurement',
    antiDoubleCount: 'issuedFingerprints rejects reuse',
    lineage: 'receipt references fingerprint, formula version, category, and epoch',
    authorization: 'mia.<fingerprint> issuance authorization',
    receipt: 'Issuance receipt is the only supply increment',
    reconciliation: 'supplyReconciles against native MoonRey units',
  },
  oracleDependency: {
    path: 'packages/sunrey-chain/src/oracle',
    note: 'Facts are not money. Issuance still depends on oracle quality.',
  },
  formula: {
    version: 'moonrey.issuance.formula.v1',
    path: 'packages/sunrey-chain/src/productive/formula.ts',
  },
  limits: {
    category: 'maximum per category per epoch',
    object: 'maximum per object per epoch',
    controller: 'maximum per controller per epoch',
    total: 'maximumTotalIssuancePerEpoch',
    path: 'packages/sunrey-chain/src/productive/issuance.ts',
  },
  tests: [
    'packages/sunrey-chain/src/productive',
    'packages/sunrey-chain/src/assurance/properties.ts',
    'packages/sunrey-chain/src/assurance/coverage.ts',
  ],
  label: 'Development/testnet economic parameters only. Not a public MoonRey Coin product.',
});
