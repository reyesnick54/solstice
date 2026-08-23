/**
 * Deterministic HIN Economic Value Input.
 *
 * This is an auditable economic metric. It is not a SunRey Coin
 * quantity, not an Exchange price, and not a mint amount.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { HinMethodologyRecord } from './methodologies.ts';
import {
  HIN_ECONOMIC_VALUE_INPUT_UNIT,
  hinFailure,
  type HinContributionRecord,
  type HinEconomicValueInput,
  type HinFailure,
} from './types.ts';
import { verificationEligibleForValueInput, verificationWeightBps } from './verification.ts';

function sha256(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

export function computeHinEconomicValueInput(input: {
  readonly record: HinContributionRecord;
  readonly methodology: HinMethodologyRecord;
  readonly timestamp: UtcInstant;
}): Result<HinEconomicValueInput, HinFailure> {
  const record = input.record;
  const methodology = input.methodology;
  if (!methodology.eligibleCategories.includes(record.category)) {
    return err(hinFailure('VALUE_INPUT_INELIGIBLE', `category ${record.category} is not eligible under ${methodology.methodologyId}`));
  }
  if (!verificationEligibleForValueInput(record.verification)) {
    return err(hinFailure('VALUE_INPUT_INELIGIBLE', `verification state ${record.verification} cannot produce an economic value input`));
  }
  if (record.qualityBps < methodology.qualityWeighting.minBps) {
    return err(hinFailure('QUALITY_BELOW_THRESHOLD', `quality ${record.qualityBps} is below methodology minimum ${methodology.qualityWeighting.minBps}`));
  }
  if (record.confidenceBps < methodology.confidenceTreatment.minBps) {
    return err(hinFailure('QUALITY_BELOW_THRESHOLD', `confidence ${record.confidenceBps} is below methodology minimum ${methodology.confidenceTreatment.minBps}`));
  }
  const verificationWeight = methodology.verificationWeightsBps[record.verification] ?? verificationWeightBps(record.verification);
  const scaled = (record.quantity * methodology.normalization.quantityScaleNumerator) / methodology.normalization.quantityScaleDenominator;
  const qualityAdjusted = (scaled * record.qualityBps * methodology.qualityWeighting.weightBps) / (10_000n * 10_000n);
  const confidenceAdjusted = (qualityAdjusted * record.confidenceBps * methodology.confidenceTreatment.weightBps) / (10_000n * 10_000n);
  const verificationAdjusted = (confidenceAdjusted * verificationWeight) / 10_000n;
  if (verificationAdjusted <= 0n) {
    return err(hinFailure('VALUE_INPUT_INELIGIBLE', 'normalized economic value input is zero'));
  }
  const capped = verificationAdjusted > methodology.caps.perEvent ? methodology.caps.perEvent : verificationAdjusted;
  const valueInputId = `hevi_${record.contributionId}_${methodology.methodologyId}_${methodology.version}`;
  const provenanceDigest = sha256(
    [
      record.contributionId,
      record.provenance.integrityDigest,
      methodology.methodologyId,
      methodology.version,
      capped.toString(),
    ].join('\n'),
  );
  return ok(
    Object.freeze({
      schema: 'sunrey.hin.economic-value-input.v1',
      valueInputId,
      contributionId: record.contributionId,
      methodologyId: methodology.methodologyId,
      methodologyVersion: methodology.version,
      inputs: Object.freeze({
        quantity: record.quantity.toString(),
        unit: record.unit,
        qualityBps: record.qualityBps.toString(),
        confidenceBps: record.confidenceBps.toString(),
        verificationState: record.verification,
        verificationWeightBps: verificationWeight.toString(),
      }),
      normalizedValue: capped,
      denomination: HIN_ECONOMIC_VALUE_INPUT_UNIT,
      confidenceBps: record.confidenceBps,
      timestamp: input.timestamp,
      provenanceDigest,
      isSunReyQuantity: false,
      isMintAmount: false,
      isMarketPrice: false,
      productionActivated: false,
    }),
  );
}
