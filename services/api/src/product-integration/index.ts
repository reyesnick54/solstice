export { PRODUCT_SERVICE_BOUNDARIES, type ProductServiceBoundaryId } from './boundaries.ts';
export {
  PRODUCT_SERVICE_STARTUP_ORDER,
  PRODUCT_STARTUP_PHASES,
  canStartService,
  servicesInPhase,
  startupOrderFor,
  type ProductServiceStartupSpec,
  type ProductStartupPhase,
} from './startup-order.ts';
export {
  createProductIntegrationRuntime,
  resolveProductIntegrationMode,
  type ProductIntegrationMode,
  type ProductIntegrationOptions,
  type ProductIntegrationRuntime,
} from './runtime.ts';
