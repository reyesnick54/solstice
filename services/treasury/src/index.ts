/**
 * Treasury application facade. Canonical treasury state lives in packages/treasury.
 * This service is not a second treasury model and cannot bypass the Kernel.
 */
export {
  TreasuryService,
  TreasuryStore,
  seedTreasuryStore,
  registerTreasuryLedgerBooks,
  TREASURY_SEED_IDS,
  ROUTING_VERSION,
  type TreasuryServiceOutcome,
} from '../../packages/treasury/src/index.ts';
