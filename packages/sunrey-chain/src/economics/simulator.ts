/**
 * Deterministic MonetaryPolicySimulator.
 *
 * All output is classified ENGINEERING_SIMULATION. This does not
 * decide production tokenomics.
 */

import { nativeAssetConstitution } from './constitution.ts';
import { authorizeIssuance, developmentMoonReyAuthority, developmentSunReyAuthority } from './issuance.ts';
import { burn, burnReservedFee, lock, reserveFee, transfer, unlock } from './operations.ts';
import { emptyBook, snapshotOf, supplyReconciles, type AssetSupplyBook } from './supply.ts';
import {
  ENGINEERING_SIMULATION,
  type ConcentrationAnalysis,
  type GenesisDistributionCategory,
  type NativeLockClass,
  type NativeMonetaryAssetId,
  type NativeSupplySnapshot,
} from './types.ts';

export type SimulationEvent =
  | { readonly kind: 'ISSUE_SUNREY'; readonly account: string; readonly quantity: bigint; readonly replay: string; readonly class?: 'GOVERNED_ISSUANCE' | 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION' | 'GENESIS_ONLY' }
  | { readonly kind: 'ISSUE_MOONREY'; readonly account: string; readonly quantity: bigint; readonly replay: string; readonly contributionId: string }
  | { readonly kind: 'TRANSFER'; readonly asset: NativeMonetaryAssetId; readonly from: string; readonly to: string; readonly quantity: bigint }
  | { readonly kind: 'LOCK'; readonly asset: NativeMonetaryAssetId; readonly account: string; readonly lockId: string; readonly quantity: bigint; readonly lockClass: NativeLockClass }
  | { readonly kind: 'UNLOCK'; readonly asset: NativeMonetaryAssetId; readonly lockId: string }
  | { readonly kind: 'FEE'; readonly asset: NativeMonetaryAssetId; readonly account: string; readonly quantity: bigint; readonly burn?: boolean }
  | { readonly kind: 'BURN'; readonly asset: NativeMonetaryAssetId; readonly account: string; readonly quantity: bigint };

export type MonetaryPolicySimulatorInput = {
  readonly events: readonly SimulationEvent[];
  readonly genesisAllocations?: Readonly<Record<NativeMonetaryAssetId, bigint>>;
};

export type MonetaryPolicySimulatorOutput = {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly trajectories: readonly {
    readonly height: number;
    readonly SUNREY_COIN: NativeSupplySnapshot;
    readonly MOONREY_COIN: NativeSupplySnapshot;
  }[];
  readonly issuanceTrajectory: readonly { readonly height: number; readonly asset: NativeMonetaryAssetId; readonly quantity: bigint }[];
  readonly burnTrajectory: readonly { readonly height: number; readonly asset: NativeMonetaryAssetId; readonly quantity: bigint }[];
  readonly final: { readonly SUNREY_COIN: NativeSupplySnapshot; readonly MOONREY_COIN: NativeSupplySnapshot };
  readonly concentration: ConcentrationAnalysis;
  readonly warnings: readonly string[];
  readonly ok: boolean;
};

export class MonetaryPolicySimulator {
  readonly classification = ENGINEERING_SIMULATION;

  run(input: MonetaryPolicySimulatorInput): MonetaryPolicySimulatorOutput {
    const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    const books: Record<NativeMonetaryAssetId, AssetSupplyBook> = {
      SUNREY_COIN: emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
      MOONREY_COIN: emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId),
    };
    const trajectories: MonetaryPolicySimulatorOutput['trajectories'][number][] = [];
    const issuanceTrajectory: MonetaryPolicySimulatorOutput['issuanceTrajectory'][number][] = [];
    const burnTrajectory: MonetaryPolicySimulatorOutput['burnTrajectory'][number][] = [];
    const warnings: string[] = [];
    const categoryTotals = new Map<GenesisDistributionCategory, bigint>();

    const genesis = input.genesisAllocations ?? { SUNREY_COIN: 0n, MOONREY_COIN: 0n };
    if (genesis.SUNREY_COIN > 0n) {
      const issued = authorizeIssuance(
        constitution,
        books.SUNREY_COIN,
        developmentSunReyAuthority({
          recipient: 'genesis.treasury',
          quantity: genesis.SUNREY_COIN,
          replayIdentifier: 'genesis-sunrey',
          issuanceClass: 'GENESIS_ONLY',
        }),
      );
      if (issued.ok) {
        books.SUNREY_COIN = issued.book;
        categoryTotals.set('TREASURY', (categoryTotals.get('TREASURY') ?? 0n) + genesis.SUNREY_COIN);
      } else {
        warnings.push(`genesis SunRey refused: ${issued.code}`);
      }
    }
    if (genesis.MOONREY_COIN > 0n) {
      warnings.push('non-zero MoonRey genesis is an engineering simulation only');
    }

    input.events.forEach((event, height) => {
      if (event.kind === 'ISSUE_SUNREY') {
        const issued = authorizeIssuance(
          constitution,
          books.SUNREY_COIN,
          developmentSunReyAuthority({
            recipient: event.account,
            quantity: event.quantity,
            replayIdentifier: event.replay,
            issuanceClass: event.class ?? 'GOVERNED_ISSUANCE',
          }),
        );
        if (issued.ok) {
          books.SUNREY_COIN = issued.book;
          issuanceTrajectory.push({ height, asset: 'SUNREY_COIN', quantity: event.quantity });
        } else {
          warnings.push(`SunRey issuance refused at ${height}: ${issued.code}`);
        }
      } else if (event.kind === 'ISSUE_MOONREY') {
        const issued = authorizeIssuance(
          constitution,
          books.MOONREY_COIN,
          developmentMoonReyAuthority({
            recipient: event.account,
            quantity: event.quantity,
            replayIdentifier: event.replay,
            contributionId: event.contributionId,
            fingerprint: `fp.${event.contributionId}`,
            authorizationId: `mia.${event.contributionId}`,
          }),
        );
        if (issued.ok) {
          books.MOONREY_COIN = issued.book;
          issuanceTrajectory.push({ height, asset: 'MOONREY_COIN', quantity: event.quantity });
        } else {
          warnings.push(`MoonRey issuance refused at ${height}: ${issued.code}`);
        }
      } else if (event.kind === 'TRANSFER') {
        books[event.asset] = transfer(books[event.asset], event.from, event.to, event.quantity);
      } else if (event.kind === 'LOCK') {
        books[event.asset] = lock(books[event.asset], event.account, event.lockId, event.quantity, event.lockClass);
      } else if (event.kind === 'UNLOCK') {
        books[event.asset] = unlock(books[event.asset], event.lockId);
      } else if (event.kind === 'FEE') {
        books[event.asset] = reserveFee(books[event.asset], event.account, event.quantity);
        if (event.burn) {
          const burned = burnReservedFee(books[event.asset], event.account, event.quantity);
          if (burned.ok) {
            books[event.asset] = burned.book;
            burnTrajectory.push({ height, asset: event.asset, quantity: event.quantity });
          }
        }
      } else if (event.kind === 'BURN') {
        const burned = burn(books[event.asset], event.account, event.quantity, 'VOLUNTARY_USER_BURN');
        if (burned.ok) {
          books[event.asset] = burned.book;
          burnTrajectory.push({ height, asset: event.asset, quantity: event.quantity });
        } else {
          warnings.push(`burn refused at ${height}: ${burned.code}`);
        }
      }
      if (!supplyReconciles(books.SUNREY_COIN) || !supplyReconciles(books.MOONREY_COIN)) {
        warnings.push(`supply identity failed at height ${height}`);
      }
      trajectories.push(
        Object.freeze({
          height,
          SUNREY_COIN: snapshotOf(books.SUNREY_COIN),
          MOONREY_COIN: snapshotOf(books.MOONREY_COIN),
        }),
      );
    });

    const concentration = analyzeConcentration(books, categoryTotals);
    return Object.freeze({
      classification: ENGINEERING_SIMULATION,
      trajectories: Object.freeze(trajectories),
      issuanceTrajectory: Object.freeze(issuanceTrajectory),
      burnTrajectory: Object.freeze(burnTrajectory),
      final: Object.freeze({
        SUNREY_COIN: snapshotOf(books.SUNREY_COIN),
        MOONREY_COIN: snapshotOf(books.MOONREY_COIN),
      }),
      concentration,
      warnings: Object.freeze(warnings),
      ok: warnings.every((row) => !row.includes('identity failed')) && supplyReconciles(books.SUNREY_COIN) && supplyReconciles(books.MOONREY_COIN),
    });
  }
}

export function analyzeConcentration(
  books: Readonly<Record<NativeMonetaryAssetId, AssetSupplyBook>>,
  categoryTotals: ReadonlyMap<GenesisDistributionCategory, bigint>,
): ConcentrationAnalysis {
  const accountConcentration = [...books.SUNREY_COIN.positions.values()]
    .concat([...books.MOONREY_COIN.positions.values()])
    .map((position) => {
      const quantity = position.circulating + position.locked + position.escrowed + position.feeReserved;
      const total = books[position.account.startsWith('moon') ? 'MOONREY_COIN' : 'SUNREY_COIN']
        ? books.SUNREY_COIN.circulating + books.SUNREY_COIN.locked + books.SUNREY_COIN.escrowed + books.SUNREY_COIN.feeReserved
        : 1n;
      return Object.freeze({
        account: position.account,
        quantity,
        shareNumerator: quantity,
        shareDenominator: total === 0n ? 1n : total,
      });
    });
  return Object.freeze({
    classification: ENGINEERING_SIMULATION,
    accountConcentration: Object.freeze(accountConcentration),
    categoryConcentration: Object.freeze(
      [...categoryTotals.entries()].map(([category, quantity]) => Object.freeze({ category, quantity })),
    ),
    issuanceAuthorityConcentration: Object.freeze([
      Object.freeze({
        source: 'DEVELOPMENT_GOVERNED_SIMULATION' as const,
        quantity: books.SUNREY_COIN.issuedPostGenesis,
      }),
      Object.freeze({
        source: 'MOONREY_PRODUCTIVE_AUTHORIZATION' as const,
        quantity: books.MOONREY_COIN.issuedPostGenesis,
      }),
    ]),
    genesisConcentration: Object.freeze(
      [...categoryTotals.entries()].map(([category, quantity]) => Object.freeze({ category, quantity })),
    ),
    legalOrPoliticalConclusion: null,
  });
}

export function requiredScenarios(): Readonly<Record<string, MonetaryPolicySimulatorOutput>> {
  const simulator = new MonetaryPolicySimulator();
  return Object.freeze({
    zeroProductionGenesis: simulator.run({ events: [], genesisAllocations: { SUNREY_COIN: 0n, MOONREY_COIN: 0n } }),
    developmentSunReyGovernedIssuance: simulator.run({
      events: [
        { kind: 'ISSUE_SUNREY', account: 'alice', quantity: 1_000n, replay: 'gov-1', class: 'GOVERNED_ISSUANCE' },
      ],
    }),
    authorizedHumanContribution: simulator.run({
      events: [
        {
          kind: 'ISSUE_SUNREY',
          account: 'contributor',
          quantity: 250n,
          replay: 'human-1',
          class: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
        },
      ],
    }),
    moonreyProductiveIssuance: simulator.run({
      events: [
        { kind: 'ISSUE_MOONREY', account: 'producer', quantity: 75n, replay: 'prod-1', contributionId: 'contrib_energy_1' },
      ],
    }),
    highProductiveActivity: simulator.run({
      events: [1, 2, 3, 4, 5].map((i) => ({
        kind: 'ISSUE_MOONREY' as const,
        account: `producer_${i}`,
        quantity: 40n,
        replay: `prod-high-${i}`,
        contributionId: `contrib_high_${i}`,
      })),
    }),
    lowProductiveActivity: simulator.run({
      events: [
        { kind: 'ISSUE_MOONREY', account: 'producer', quantity: 1n, replay: 'prod-low', contributionId: 'contrib_low_1' },
      ],
    }),
    highLocking: simulator.run({
      events: [
        { kind: 'ISSUE_SUNREY', account: 'alice', quantity: 1_000n, replay: 'lock-src' },
        { kind: 'LOCK', asset: 'SUNREY_COIN', account: 'alice', lockId: 'ord-1', quantity: 400n, lockClass: 'ORDER_RESERVATION' },
        { kind: 'LOCK', asset: 'SUNREY_COIN', account: 'alice', lockId: 'esc-1', quantity: 200n, lockClass: 'MACHINE_ESCROW' },
        { kind: 'LOCK', asset: 'SUNREY_COIN', account: 'alice', lockId: 'bond-1', quantity: 100n, lockClass: 'VALIDATOR_BOND' },
      ],
    }),
    highTransactionFeeActivity: simulator.run({
      events: [
        { kind: 'ISSUE_SUNREY', account: 'alice', quantity: 500n, replay: 'fee-src' },
        { kind: 'FEE', asset: 'SUNREY_COIN', account: 'alice', quantity: 20n, burn: true },
        { kind: 'FEE', asset: 'SUNREY_COIN', account: 'alice', quantity: 15n, burn: true },
        { kind: 'FEE', asset: 'SUNREY_COIN', account: 'alice', quantity: 10n, burn: true },
      ],
    }),
  });
}
