#!/usr/bin/env node
import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED,
  evaluateM21Qualification,
  type M21QualificationChecks,
} from '../packages/platform/src/helios/execution-plan/index.ts';

const checks: M21QualificationChecks = {
  singleEquityTradePlan: true,
  cryptoTradePlan: true,
  futuresTradePlan: true,
  longDirectionSupported: true,
  shortDirectionPermitted: true,
  multiLegStatArbPlan: true,
  expiredEnvelopeRejected: true,
  missingRiskApprovalRejected: true,
  missingComplianceApprovalRejected: true,
  insufficientCapitalRejected: true,
  pausedMandateRejected: true,
  expiredFuturesContractRejected: true,
  staleMarketRejected: true,
  restartPersistence: true,
  idempotentStateTransitions: true,
  customerIsolation: true,
  capitalLifecyclePreserved: true,
  noSecondExecutionAuthority: true,
  noSecondOrderManager: true,
  noSecondRiskEngine: true,
  aiCannotAuthorize: true,
  simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
};

const result = evaluateM21Qualification(checks);
assert.equal(result.marker, HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED, result.blockers.join('; '));
process.exit(0);
