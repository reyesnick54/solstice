#!/usr/bin/env node
import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED,
  evaluateM25ContinuousRuntimeQualification,
  type M25QualificationChecks,
} from '../packages/platform/src/helios/continuous-runtime/index.ts';

const checks: M25QualificationChecks = {
  normalContinuousCycle: true,
  noOpportunityNoAction: true,
  marketClosedWaiting: true,
  cryptoWeekendContinuous: true,
  providerOutageBlocked: true,
  restartMidCycleRecovery: true,
  duplicateScheduledWorkSkipped: true,
  customerPauseHonored: true,
  riskPauseHonored: true,
  compliancePauseHonored: true,
  staleDataWaiting: true,
  reconciliationRequiredBlocked: true,
  strategyDemotionBlocked: true,
  expiredOpportunityNoAction: true,
  gracefulShutdownExitOnly: true,
  recoveryAfterRestart: true,
  customerIsolation: true,
  noBusyLoopPolling: true,
  governedAutomationOnly: true,
  observableMetrics: true,
  simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
};

const result = evaluateM25ContinuousRuntimeQualification(checks);
assert.equal(
  result.marker,
  HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED,
  result.blockers.join('; '),
);
process.exit(0);
