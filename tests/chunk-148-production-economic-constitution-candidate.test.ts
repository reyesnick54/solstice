import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import { evaluateProductionEconomicActivation } from '../packages/sunrey-chain/src/economics/production-activation/index.ts';
import {
  currentActivationSnapshot,
  currentRepositoryBundleInput,
  currentRepositoryConstitutionSnapshot,
  qualifyProductionEconomicConstitutionCandidate,
} from '../packages/sunrey-chain/src/release-candidate/economic/production-constitution/index.ts';

describe('Chunk 148 exit criteria', () => {
  it('ships under the economic RC owner and forbids competing packages', () => {
    assert.equal(existsSync('docs/economics/chunk-148-production-economic-constitution-candidate.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-148.json'), true);
    assert.equal(
      existsSync('packages/sunrey-chain/src/release-candidate/economic/production-constitution/bundle.ts'),
      true,
    );
    assert.equal(existsSync('packages/economic-constitution'), false);
    assert.equal(existsSync('packages/economic-rc-v2'), false);
    assert.equal(existsSync('packages/tokenomics-release'), false);
    assert.equal(existsSync('packages/dual-economy-release'), false);
  });

  it('keeps current main awaiting parameter selection and production inactive', () => {
    const firewall = evaluateProductionEconomicActivation(currentActivationSnapshot());
    const snapshot = currentRepositoryConstitutionSnapshot();
    const hashes = currentRepositoryBundleInput(firewall.decisionId);
    const decision = qualifyProductionEconomicConstitutionCandidate({ snapshot, hashes, firewall });
    assert.equal(decision.result, 'AWAITING_PARAMETER_SELECTION');
    assert.equal(decision.productionActivated, false);
    assert.equal(decision.parameterCoverage.every((row) => row.status === 'UNCONFIGURED'), true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
  });

  it('does not implement an activation function', () => {
    const source = readFileSync(
      'packages/sunrey-chain/src/release-candidate/economic/production-constitution/qualification.ts',
      'utf8',
    );
    assert.equal(source.includes('function activateProduction'), false);
    assert.equal(source.includes('enableMainnetMoney'), false);
    assert.equal(/productionActivated:\s*true/.test(source), false);
  });
});
