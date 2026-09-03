/**
 * Wave 4 — Information Consensus integration tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateInformationConsensus,
  informationConsensusCreatesMoney,
  toOracleVerifiedEconomicFactCandidate,
} from '@solstice/sunrey-chain/economic-awareness-fabric';
import {
  buildConsensusInput,
  PRODUCTIVE_ENERGY_CANDIDATE,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
} from '@solstice/sunrey-chain/economic-awareness-fabric';

describe('Wave 4 — Information Consensus integration', () => {
  it('exports a versioned evaluation boundary with zero monetary authority', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.equal(evaluation.receipt.grantsExecutionAuthority, false);
    assert.equal(informationConsensusCreatesMoney(), false);
  });

  it('maps verified information fact to oracle candidate without minting', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.ok(evaluation.verifiedFact);
    const oracleCandidate = toOracleVerifiedEconomicFactCandidate(evaluation.verifiedFact!);
    assert.ok(oracleCandidate);
    assert.equal(oracleCandidate?.qualityStatus, 'VERIFIED');
    assert.match(oracleCandidate?.feedId ?? '', /^information-consensus:/);
  });

  it('fails closed for shared upstream without independent corroboration', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.verifiedFact, null);
  });
});
