export const ECONOMIC_REVIEW_PACKAGE = Object.freeze({
  title: 'Economic review package',
  environment: 'simulation',
  tickers: 'NOT_ASSIGNED',
  invariants: [
    {
      id: 'ECO-SUNREY-SUPPLY',
      name: 'SunRey native supply',
      description: 'SunRey native units are conserved except for explicitly authorized protocol operations. Supply is read from chain state.',
      paths: ['packages/sunrey-chain/src/native-assets', 'packages/sunrey-chain/rust/crates/native-assets'],
      tests: ['packages/sunrey-chain/src/native-assets/native-assets.test.ts', 'packages/sunrey-chain/src/assurance/properties.ts'],
    },
    {
      id: 'ECO-MOONREY-SUPPLY',
      name: 'MoonRey native supply',
      description: 'MoonRey native units increase only through productive issuance receipts. Arbitrary ISSUE is unavailable.',
      paths: ['packages/sunrey-chain/src/productive/issuance.ts'],
      tests: ['packages/sunrey-chain/src/assurance/properties.ts'],
    },
    {
      id: 'ECO-FEES',
      name: 'fees',
      description: 'Integer fee schedule. Reserve, charge, and release. No floating-point.',
      paths: ['packages/sunrey-chain/src/fees'],
      tests: ['packages/sunrey-chain/src/fees.test.ts'],
    },
    {
      id: 'ECO-LOCKS',
      name: 'locks',
      description: 'Locked units are not withdrawable and are not treated as growth.',
      paths: ['packages/sunrey-chain/src/native-assets', 'packages/sunrey-exchange/src/native-clearing'],
      tests: ['packages/sunrey-exchange/src'],
    },
    {
      id: 'ECO-EXCHANGE-DVP',
      name: 'Exchange DVP',
      description: 'Delivery versus payment: both legs reserve before settlement. No silent inventory.',
      paths: ['packages/sunrey-exchange/src/native-clearing'],
      tests: ['tests/assurance/exchange.test.ts'],
    },
    {
      id: 'ECO-CUSTODY-RECONCILE',
      name: 'custody reconciliation',
      description: 'Custody positions reconcile to finalized chain state. Simulation custody is not a vault.',
      paths: ['packages/custody', 'packages/sunrey-chain/src/native-custody'],
      tests: ['packages/custody/src'],
    },
    {
      id: 'ECO-MOONREY-PRODUCTIVE',
      name: 'MoonRey productive issuance',
      description: 'Issuance requires a verified productive contribution, fingerprint uniqueness, and epoch caps.',
      paths: ['packages/sunrey-chain/src/productive'],
      tests: ['packages/sunrey-chain/src/productive'],
    },
    {
      id: 'ECO-INTEROP-TEST-ASSET',
      name: 'interop test asset',
      description: 'Interop test units are development-only and do not mint native SunRey or MoonRey supply.',
      paths: ['packages/sunrey-chain/src/interop'],
      tests: ['packages/sunrey-chain/src/interop'],
    },
  ],
  forbiddenFields: [
    'percentage-return',
    'growth-rate field',
    'blended-performance field',
  ]
  note: 'Cost-avoided is never income. Unrealized is never withdrawable. Principal movement is not growth.',
});
