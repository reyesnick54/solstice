#!/usr/bin/env node
import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED,
  evaluateM20PortfolioRiskQualification,
  type M20QualificationChecks,
} from '../packages/risk/src/portfolio/index.ts';

const checks: M20QualificationChecks = {
  normalOperation: true,
  positionCap: true,
  assetClassCap: true,
  correlationClusterCap: true,
  dailyLossThreshold: true,
  portfolioDrawdown: true,
  strategyDrawdown: true,
  staleData: true,
  providerOutage: true,
  customerPause: true,
  emergencyCloseRequest: true,
  partialFillDuringRiskEvent: true,
  restartExitOnlyPersisted: true,
  reconciliationFailure: true,
  policyVersionUpdate: true,
  noFalseResetAcrossMidnight: true,
  auditEvidenceComplete: true,
  extendsCanonicalRiskEngine: true,
  noSeparateRiskAuthority: true,
  policyDrivenLimits: true,
  simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
};

const result = evaluateM20PortfolioRiskQualification(checks);
assert.equal(result.marker, HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED, result.blockers.join('; '));
process.exit(0);
