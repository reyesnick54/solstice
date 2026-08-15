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
  createCardHoldGateway,
  type CardHoldGateway,
  type CardsServiceOutcome,
  type ProcessorCallbackEnvelope,
} from './public.ts';
