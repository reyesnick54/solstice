import { InMemorySecretProvider } from '../../../packages/security/src/secrets.ts';
import { CardsService } from '../../../packages/cards/src/index.ts';
import { PaymentsService } from '../../../packages/payments/src/service.ts';
import { FinancialControlService, TreasuryService } from '../../../packages/treasury/src/index.ts';
import { seedSimulationCatalog } from '../../accounts/src/catalog.ts';
import { createCardHoldGateway } from '../../cards/src/hold-gateway.ts';
import type { SimulationRuntime } from '../../accounts/src/runtime.ts';
const CARD_PROCESSOR_SECRET = 'sim-card-processor-hmac-not-a-production-secret';

export type ConsumerMoneySurface = {
  readonly payments: PaymentsService;
  readonly cards: CardsService;
  readonly treasury: TreasuryService;
  readonly control: FinancialControlService;
};

export function createConsumerMoneySurface(runtime: SimulationRuntime): ConsumerMoneySurface {
  const seeded = seedSimulationCatalog();
  const catalog = {
    customers: runtime.customers,
    accounts: runtime.accounts,
    products: seeded.products.asCatalog(),
    legalEntities: seeded.legalEntities,
  };
  const treasury = new TreasuryService(
    runtime.kernel,
    runtime.issuer,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    catalog,
    runtime.identity.service,
    { ledger: runtime.ledger, seed: true },
  );
  const payments = new PaymentsService(
    runtime.kernel,
    runtime.issuer,
    runtime.ledger,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    catalog,
    runtime.identity.service,
    { treasury },
  );
  const secrets = new InMemorySecretProvider('simulation', {
    'card-processor-callback': CARD_PROCESSOR_SECRET,
    'wallet-provider-callback': CARD_PROCESSOR_SECRET,
    'acceptance-provider-callback': CARD_PROCESSOR_SECRET,
  });
  const cards = new CardsService(
    runtime.kernel,
    runtime.issuer,
    runtime.ledger,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    catalog,
    runtime.identity.service,
    createCardHoldGateway(runtime.banking, runtime.ledger, runtime.clock),
    secrets,
    { processorActorId: 'operator_1', operationsActorId: 'operator_1' },
  );
  const control = new FinancialControlService(
    runtime.clock,
    runtime.evidence,
    runtime.events,
    treasury.store,
    { ledger: runtime.ledger },
  );
  return { payments, cards, treasury, control };
}
