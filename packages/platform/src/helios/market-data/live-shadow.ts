import { LIVE_TRADING_ENABLED, MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';

export type MarketDataLiveShadowPosture = {
  readonly liveShadowEnabled: boolean;
  readonly liveTradingEnabled: false;
  readonly permitsLicensedReadOnlyConnectivity: boolean;
  readonly permitsBrokerOrders: false;
  readonly permitsVenueOrders: false;
  readonly permitsCustodyMovement: false;
  readonly permitsCustomerCapitalDeployment: false;
  readonly permitsContinuousIngestion: boolean;
  readonly permitsBookReconstruction: boolean;
  readonly permitsResearchFeatures: boolean;
  readonly permitsPaperExecutionTwin: boolean;
};

/**
 * LIVE shadow mode enables bounded read-only provider ingestion for research.
 * It never enables execution, custody, or LIVE_TRADING.
 */
export function describeMarketDataLiveShadowPosture(): MarketDataLiveShadowPosture {
  const enabled = MARKET_DATA_LIVE_SHADOW_ENABLED === true;
  return Object.freeze({
    liveShadowEnabled: enabled,
    liveTradingEnabled: false,
    permitsLicensedReadOnlyConnectivity: enabled,
    permitsBrokerOrders: false,
    permitsVenueOrders: false,
    permitsCustodyMovement: false,
    permitsCustomerCapitalDeployment: false,
    permitsContinuousIngestion: enabled,
    permitsBookReconstruction: enabled,
    permitsResearchFeatures: enabled,
    permitsPaperExecutionTwin: enabled,
  });
}

export function assertMarketDataLiveShadowSafe(): void {
  if (LIVE_TRADING_ENABLED !== false) {
    throw new Error('MARKET_DATA live shadow forbids LIVE_TRADING_ENABLED');
  }
  const posture = describeMarketDataLiveShadowPosture();
  if (posture.permitsBrokerOrders || posture.permitsVenueOrders) {
    throw new Error('live shadow must not permit order submission');
  }
}
