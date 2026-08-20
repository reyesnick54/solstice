import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { convertExact } from './units/convert.ts';
import { evaluateAttribution } from './productive/policy-governance/attribution/engine.ts';
import { developmentAttributionPolicy } from './productive/policy-governance/attribution/policy.ts';
import { computePair, relationship, subject } from './productive/policy-governance/attribution/fixtures.ts';
import {
  CAPACITY_EQUALS_REALIZED_OUTPUT,
  COMPUTE_FACT_AUTO_MINTS_MOONREY,
  REAL_PROVIDER_CONTACTED,
  TOKEN_EQUALS_GPU_TIME,
  capacityDoesNotEqualUsage,
  certifyComputeObservation,
  computeCertificationDoesNotMint,
  computeEventId,
  computeUtilization,
  corroboratingSources,
  cpuExecutionFixture,
  credentialIncludedFixture,
  evaluateComputeIndependence,
  floatUsageFixture,
  genericComputeMissingClassFixture,
  genericComputeWithClassFixture,
  gpuCountOmittedFixture,
  gpuExecutionFixture,
  gpuSecondsOf,
  ingestComputeObservation,
  inferenceTokenFixture,
  modelOutputIncludedFixture,
  projectComputeMetadata,
  promptIncludedFixture,
  sameComputeExecution,
  SANDBOX_END,
  SANDBOX_NOW,
  SANDBOX_START,
  staleJobFixture,
  tokensAsGpuSecondsFixture,
  trainingGpuFixture,
  trainingLabeledInferenceFixture,
  wallTimeAsGpuFixture,
  capacityInventoryFixture,
} from './oracle/production/provider-families/compute/index.ts';

describe('CHUNK-130 compute and AI economic data fabric', () => {
  it('1. converts 1 GPU for 10 seconds into 10 GPU-seconds', () => {
    const ingested = ingestComputeObservation(gpuExecutionFixture(1n, 10n), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalUnit, 'gpu_s');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 10n);
    assert.equal(gpuSecondsOf(1n, 10n), 10n);
  });

  it('2. multiplies GPU resource count: 8 GPUs for 10 seconds = 80 GPU-seconds', () => {
    const ingested = ingestComputeObservation(gpuExecutionFixture(8n, 10n), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalQuantity.mantissa, 80n);
    assert.equal(gpuSecondsOf(8n, 10n), 80n);
    assert.notEqual(ingested.value.canonicalQuantity.mantissa, 10n);
  });

  it('3. maps CPU resource-time through canonical CPU context', () => {
    const ingested = ingestComputeObservation(cpuExecutionFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalUnit, 'cpu_s');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 40n);
    assert.equal(ingested.value.dimension, 'CPU_TIME');
  });

  it('4. rejects generic compute_s without resource class', () => {
    const ingested = ingestComputeObservation(genericComputeMissingClassFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (ingested.ok) {
      return;
    }
    assert.equal(ingested.error.code, 'NORMALIZATION_CONTEXT_REQUIRED');
  });

  it('5. classifies generic compute with CPU context', () => {
    const ingested = ingestComputeObservation(genericComputeWithClassFixture('CPU'), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalUnit, 'cpu_s');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 40n);
  });

  it('6. classifies generic compute with GPU context', () => {
    const ingested = ingestComputeObservation(genericComputeWithClassFixture('GPU'), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalUnit, 'gpu_s');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 80n);
  });

  it('7. retains inference tokens as token_inference semantics', () => {
    const ingested = ingestComputeObservation(inferenceTokenFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    assert.equal(ingested.value.canonicalUnit, 'TOKEN');
    assert.equal(ingested.value.dimension, 'AI_TOKEN_COUNT');
    assert.equal(ingested.value.measurement.semanticQualifier, 'INFERENCE_PROCESSED_TOKENS');
    assert.equal(ingested.value.tokenBreakdown?.mapsToTokenInference, true);
  });

  it('8. refuses a physical token → GPU-time conversion', () => {
    const ingested = ingestComputeObservation(tokensAsGpuSecondsFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (ingested.ok) {
      return;
    }
    assert.equal(ingested.error.code, 'TOKEN_GPU_CONVERSION_FORBIDDEN');
    const conversion = convertExact({
      source: { mantissa: 1200n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'token_inference' },
      targetUnitId: 'gpu_s',
    });
    assert.equal(conversion.ok, false);
    assert.equal(TOKEN_EQUALS_GPU_TIME, false);
  });

  it('9. refuses training that silently reuses inference token semantics', () => {
    const ingested = ingestComputeObservation(trainingLabeledInferenceFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (ingested.ok) {
      return;
    }
    assert.equal(ingested.error.code, 'TRAINING_INFERENCE_TOKEN_SEMANTIC');
    const training = ingestComputeObservation(trainingGpuFixture(), SANDBOX_NOW);
    assert.equal(training.ok, true);
    if (training.ok) {
      assert.equal(training.value.canonicalUnit, 'gpu_s');
      assert.equal(training.value.factType, 'AI_TRAINING_USAGE');
    }
  });

  it('10. treats capacity as distinct from realized usage', () => {
    const capacity = ingestComputeObservation(capacityInventoryFixture(), SANDBOX_NOW);
    const usage = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    assert.equal(capacity.ok, true);
    assert.equal(usage.ok, true);
    if (!capacity.ok || !usage.ok) {
      return;
    }
    assert.equal(capacity.value.factType, 'AI_COMPUTE_CAPACITY');
    assert.equal(usage.value.factType, 'COMPUTE_USAGE');
    assert.equal(capacityDoesNotEqualUsage(capacity.value.factType, usage.value.factType), true);
    assert.equal(CAPACITY_EQUALS_REALIZED_OUTPUT, false);
    assert.notEqual(capacity.value.canonicalQuantity.mantissa, usage.value.canonicalQuantity.mantissa);
  });

  it('11. deduplicates one execution seen by scheduler, billing, and GPU telemetry', () => {
    const sources = corroboratingSources();
    assert.equal(sameComputeExecution(sources[0]!, sources[1]!), true);
    assert.equal(sameComputeExecution(sources[1]!, sources[2]!), true);
    assert.equal(computeEventId(sources[0]!), computeEventId(sources[2]!));
  });

  it('12. applies COMPUTE + AI_COMPUTE same-execution attribution policy', () => {
    const pair = computePair(true);
    const evaluation = evaluateAttribution({
      height: 1,
      policy: developmentAttributionPolicy(),
      subjects: [pair.compute, pair.ai],
      relationships: [relationship(pair.compute.economicEventId, pair.ai.economicEventId, 'SAME_UNDERLYING_EVENT')],
    });
    const computeDecision = evaluation.decisions.find((item) => item.category === 'COMPUTE');
    const aiDecision = evaluation.decisions.find((item) => item.category === 'AI_COMPUTE');
    assert.ok(computeDecision);
    assert.ok(aiDecision);
    assert.equal(computeDecision?.decision, 'FULL_ATTRIBUTION');
    assert.equal(aiDecision?.decision, 'ZERO_DUPLICATE_ATTRIBUTION');
    assert.ok(aiDecision?.reasonCodes.includes('COMPUTE_AI_SAME_EXECUTION'));
  });

  it('13. keeps distinct training and inference executions separate', () => {
    const inference = inferenceTokenFixture();
    const training = trainingGpuFixture();
    assert.equal(sameComputeExecution(inference, training), false);
    assert.notEqual(computeEventId(inference), computeEventId(training));
    const evaluation = evaluateAttribution({
      height: 1,
      policy: developmentAttributionPolicy(),
      subjects: [
        subject({
          claimId: 'claim.infer',
          economicEventId: computeEventId(inference),
          category: 'AI_COMPUTE',
          controllerId: 'controller.a',
          claimType: 'USAGE',
          eventClass: 'USAGE',
        }),
        subject({
          claimId: 'claim.train',
          economicEventId: computeEventId(training),
          category: 'AI_COMPUTE',
          controllerId: 'controller.a',
          claimType: 'USAGE',
          eventClass: 'USAGE',
        }),
      ],
    });
    assert.equal(evaluation.decisions.every((item) => item.decision !== 'ZERO_DUPLICATE_ATTRIBUTION'), true);
  });

  it('14. refuses raw prompts and keeps them off the economic record', () => {
    const ingested = ingestComputeObservation(promptIncludedFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'PROMPT_CONTENT_FORBIDDEN');
    }
    const clean = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    assert.equal(clean.ok, true);
    if (clean.ok) {
      assert.equal(clean.value.promptContentStored, false);
      assert.equal(clean.value.execution.promptContentStored, false);
      assert.equal('extras' in clean.value, false);
    }
  });

  it('15. refuses model outputs on the economic record', () => {
    const ingested = ingestComputeObservation(modelOutputIncludedFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'MODEL_OUTPUT_FORBIDDEN');
    }
  });

  it('16. refuses credentials on the economic record', () => {
    const ingested = ingestComputeObservation(credentialIncludedFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'CREDENTIAL_MATERIAL_FORBIDDEN');
    }
  });

  it('17. rejects a same-controller fake quorum', () => {
    const independence = evaluateComputeIndependence(gpuExecutionFixture());
    assert.equal(independence.fakeQuorum, true);
    assert.equal(independence.verdict, 'FAIL');
  });

  it('18. validates utilization dimensions and matching periods', () => {
    const usage = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    const capacity = ingestComputeObservation(capacityInventoryFixture(), SANDBOX_NOW);
    assert.equal(usage.ok && capacity.ok, true);
    if (!usage.ok || !capacity.ok) {
      return;
    }
    const mismatch = computeUtilization({
      actual: usage.value.canonicalQuantity,
      capacity: inferenceTokenFixture().tokenBreakdown
        ? { mantissa: 1200n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'token_inference' }
        : usage.value.canonicalQuantity,
      actualStart: SANDBOX_START,
      actualEnd: SANDBOX_END,
      capacityStart: SANDBOX_START,
      capacityEnd: SANDBOX_END,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.equal(mismatch.error.code, 'UTILIZATION_DIMENSION_MISMATCH');
    }
    const compatible = computeUtilization({
      actual: usage.value.canonicalQuantity,
      capacity: { mantissa: 28800n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'gpu_s' },
      actualStart: SANDBOX_START,
      actualEnd: SANDBOX_END,
      capacityStart: SANDBOX_START,
      capacityEnd: SANDBOX_END,
    });
    assert.equal(compatible.ok, true);
  });

  it('19. never contacts a real provider', () => {
    assert.equal(REAL_PROVIDER_CONTACTED, false);
    const ingested = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.realProviderContacted, false);
    }
  });

  it('20. compute facts cannot auto-mint MoonRey', () => {
    const ingested = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    assert.equal(COMPUTE_FACT_AUTO_MINTS_MOONREY, false);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.computeFactAutoMintsMoonRey, false);
    }
  });

  it('21. certification cannot auto-mint MoonRey', () => {
    const certified = certifyComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    assert.equal(computeCertificationDoesNotMint(), false);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(certified.record.productionAuthorized, false);
    assert.equal(certified.record.status, 'TESTNET_ADMISSIBLE');
  });

  it('rejects wall-time labeled as GPU-time, omitted GPU count, floats, and stale jobs', () => {
    assert.equal(ingestComputeObservation(wallTimeAsGpuFixture(), SANDBOX_NOW).ok, false);
    assert.equal(ingestComputeObservation(gpuCountOmittedFixture(), SANDBOX_NOW).ok, false);
    assert.equal(ingestComputeObservation(floatUsageFixture(), SANDBOX_NOW).ok, false);
    assert.equal(ingestComputeObservation(staleJobFixture(), SANDBOX_NOW).ok, false);
  });

  it('projects compute metadata into the Economic Asset Registry without payloads', () => {
    const ingested = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      return;
    }
    const projected = projectComputeMetadata(new EconomicAssetRegistry(), ingested.value);
    assert.equal(projected.ok, true);
    if (projected.ok) {
      assert.equal(JSON.stringify(projected.value).toLowerCase().includes('prompt'), false);
      assert.equal(projected.value.economicCategory, 'COMPUTE');
    }
  });
});
