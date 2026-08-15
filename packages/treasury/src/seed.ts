import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import type { AccountRegister } from '../../ledger/src/accounts.ts';
import type { LedgerAccount } from '../../ledger/src/types.ts';
import { Money } from '../../money/src/money.ts';
import { freezeTreasuryAccount, type TreasuryAccount } from './account.ts';
import { emptyFxInventory } from './inventory.ts';
import { asFxInventoryId, asTreasuryAccountId, asTreasuryPositionId } from './ids.ts';
import { freezePosition, type TreasuryPosition } from './position.ts';
import type { TreasuryStore } from './store.ts';

export const TREASURY_SEED_IDS = {
  providerASar: asTreasuryAccountId('ta_provider_a_sar_prefund'),
  providerBSar: asTreasuryAccountId('ta_provider_b_sar_prefund'),
  usUsdSettlement: asTreasuryAccountId('ta_us_provider_a_usd_settlement'),
  saSarPrefund: asTreasuryAccountId('ta_sa_provider_b_sar_prefund'),
  fxUsd: asTreasuryAccountId('ta_fx_clearing_usd'),
  fxSar: asTreasuryAccountId('ta_fx_clearing_sar'),
} as const;

export const TREASURY_LEDGER_BOOKS = {
  providerASar: 'SIMULATION.TREASURY.PROVIDER_A.SAR',
  providerBSar: 'SIMULATION.TREASURY.PROVIDER_B.SAR',
  usUsdSettlement: 'SIMULATION.TREASURY.PROVIDER_A.USD',
  saSarPrefund: 'SIMULATION.TREASURY.SA_PROVIDER_B.SAR',
  fxUsd: 'SIMULATION.FX_INVENTORY.USD',
  fxSar: 'SIMULATION.FX_INVENTORY.SAR',
} as const;

const SEED_NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function book(
  id: string,
  name: string,
  kind: TreasuryAccount['kind'],
  legalEntityId: string,
  currency: 'USD' | 'SAR' | 'EUR' | 'GBP' | 'AED',
  country: string,
  provider: string,
  rail: string,
  corridorId: string | null,
  ledgerAccountId: string,
): TreasuryAccount {
  return freezeTreasuryAccount({
    treasuryAccountId: asTreasuryAccountId(id),
    name,
    kind,
    ownership: 'SIMULATION_SYSTEM',
    legalEntityId: asLegalEntityId(legalEntityId),
    currency: asCurrencyCode(currency),
    country,
    provider,
    rail,
    corridorId,
    ledgerAccountId,
    cardSettlementRef: null,
  });
}

function position(account: TreasuryAccount, availableMinor: bigint): TreasuryPosition {
  const available = Money.fromMinorUnits(availableMinor, account.currency);
  return freezePosition({
    positionId: asTreasuryPositionId(`tp_${account.treasuryAccountId}`),
    treasuryAccountId: account.treasuryAccountId,
    currency: account.currency,
    settled: available,
    available,
    reserved: Money.zero(account.currency),
    pendingInbound: Money.zero(account.currency),
    pendingOutbound: Money.zero(account.currency),
    operationalBuffer: Money.zero(account.currency),
    updatedAt: SEED_NOW,
  });
}

export function simulationTreasuryAccounts(): readonly TreasuryAccount[] {
  return Object.freeze([
    book(
      TREASURY_SEED_IDS.providerASar,
      'Provider A SAR corridor prefunding',
      'CORRIDOR_PREFUNDING',
      'le_solstice_us_inc',
      'SAR',
      'SA',
      'SIMULATED_PROVIDER_GCC',
      'INTERNATIONAL_CORRESPONDENT',
      'US-SA-USD-SAR',
      TREASURY_LEDGER_BOOKS.providerASar,
    ),
    book(
      TREASURY_SEED_IDS.providerBSar,
      'Provider B SAR corridor prefunding',
      'CORRIDOR_PREFUNDING',
      'le_solstice_us_inc',
      'SAR',
      'SA',
      'SIMULATED_PROVIDER_CORRESPONDENT',
      'INTERNATIONAL_CORRESPONDENT',
      'US-SA-USD-SAR',
      TREASURY_LEDGER_BOOKS.providerBSar,
    ),
    book(
      TREASURY_SEED_IDS.usUsdSettlement,
      'US Provider A USD settlement',
      'PROVIDER_SETTLEMENT',
      'le_solstice_us_inc',
      'USD',
      'US',
      'SIMULATED_PROVIDER_GCC',
      'INTERNATIONAL_CORRESPONDENT',
      'US-SA-USD-SAR',
      TREASURY_LEDGER_BOOKS.usUsdSettlement,
    ),
    book(
      TREASURY_SEED_IDS.saSarPrefund,
      'Saudi Provider B SAR prefunding',
      'CORRIDOR_PREFUNDING',
      'le_solstice_sa_entity',
      'SAR',
      'SA',
      'SIMULATED_PROVIDER_CORRESPONDENT',
      'INTERNATIONAL_CORRESPONDENT',
      'US-SA-USD-SAR',
      TREASURY_LEDGER_BOOKS.saSarPrefund,
    ),
    book(
      TREASURY_SEED_IDS.fxUsd,
      'Treasury FX inventory USD',
      'FX_CLEARING',
      'le_solstice_us_inc',
      'USD',
      'US',
      'SIMULATION_FX',
      'INTERNAL',
      null,
      TREASURY_LEDGER_BOOKS.fxUsd,
    ),
    book(
      TREASURY_SEED_IDS.fxSar,
      'Treasury FX inventory SAR',
      'FX_CLEARING',
      'le_solstice_us_inc',
      'SAR',
      'SA',
      'SIMULATION_FX',
      'INTERNAL',
      null,
      TREASURY_LEDGER_BOOKS.fxSar,
    ),
  ]);
}

export function seedTreasuryStore(
  store: TreasuryStore,
  options: { readonly routeASarMinor?: bigint; readonly routeBSarMinor?: bigint } = {},
): void {
  const routeA = options.routeASarMinor ?? 100_000n;
  const routeB = options.routeBSarMinor ?? 10_000_000n;
  for (const account of simulationTreasuryAccounts()) {
    store.putAccount(account);
    if (account.treasuryAccountId === TREASURY_SEED_IDS.providerASar) {
      store.putPosition(position(account, routeA));
    } else if (account.treasuryAccountId === TREASURY_SEED_IDS.providerBSar) {
      store.putPosition(position(account, routeB));
    } else if (account.currency === 'SAR') {
      store.putPosition(position(account, 5_000_000n));
    } else {
      store.putPosition(position(account, 10_000_000n));
    }
  }
  for (const currency of ['USD', 'EUR', 'GBP', 'SAR', 'AED'] as const) {
    store.putInventory(
      emptyFxInventory(asFxInventoryId(`fxinv_${currency}`), currency, SEED_NOW),
    );
  }
  const usd = store.getInventory('USD');
  const sar = store.getInventory('SAR');
  if (usd) {
    store.putInventory({
      ...usd,
      owned: Money.fromMinorUnits(50_000_000n, 'USD'),
    });
  }
  if (sar) {
    store.putInventory({
      ...sar,
      owned: Money.fromMinorUnits(20_000_000n, 'SAR'),
    });
  }
}

export function registerTreasuryLedgerBooks(register: AccountRegister): void {
  const books: readonly LedgerAccount[] = [
    sys(TREASURY_LEDGER_BOOKS.providerASar, 'Provider A SAR prefunding', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_LEDGER_BOOKS.providerBSar, 'Provider B SAR prefunding', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_LEDGER_BOOKS.usUsdSettlement, 'Provider A USD settlement', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_LEDGER_BOOKS.saSarPrefund, 'SA Provider B SAR prefunding', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_LEDGER_BOOKS.fxUsd, 'FX inventory USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_LEDGER_BOOKS.fxSar, 'FX inventory SAR', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
  ];
  for (const row of books) {
    register.registerSystemAccount(row);
  }
}

function sys(
  id: string,
  name: string,
  accountClass: LedgerAccount['accountClass'],
  currency: string,
): LedgerAccount {
  return Object.freeze({ id, name, accountClass, currency });
}
