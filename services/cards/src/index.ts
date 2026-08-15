/**
 * Cards application facade. Canonical card state lives in packages/cards.
 * This service wires Kernel-gated orchestration to banking holds.
 */
export {
  CardsService,
  SimulatedCardProcessor,
  CardStore,
  signProcessorCallback,
  verifyProcessorCallback,
  WalletService,
  AcceptanceService,
  SimulatedAppleWalletAdapter,
  SimulatedGoogleWalletAdapter,
  SimulatedTapToPayAdapter,
  signWalletCallback,
  signAcceptanceCallback,
  createCardHoldGateway,
  type CardHoldGateway,
  type CardsServiceOutcome,
  type ProcessorCallbackEnvelope,
  type WalletServiceOutcome,
  type AcceptanceServiceOutcome,
} from './public.ts';
