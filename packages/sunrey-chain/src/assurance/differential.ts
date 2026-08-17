import { encodeAddress, parseAddress } from '../wallet/index.ts';
import { calculateFee, developmentFeeSchedule } from '../fees/schedule.ts';
import { usageForOperation } from '../fees/meter.ts';
import { medianOf } from '../oracle/aggregation.ts';
import { contributionFingerprint } from '../productive/fingerprint.ts';
import { evaluateIssuanceFormula, mulDiv } from '../productive/formula.ts';
import { SeededRng } from './rng.ts';

export type DifferentialCase = {
  readonly id: string;
  readonly kind:
    | 'fee'
    | 'muldiv'
    | 'formula'
    | 'fingerprint'
    | 'median'
    | 'address';
  readonly input: Record<string, string | number>;
  readonly expected: Record<string, string>;
};

export function evaluateDifferentialCase(item: DifferentialCase): Record<string, string> {
  if (item.kind === 'fee') {
    const usage = usageForOperation(
      'NATIVE_TRANSFER',
      Number(item.input.encodedBytes),
      Number(item.input.signatureCount),
    );
    return { fee: calculateFee(developmentFeeSchedule(), usage).toString() };
  }
  if (item.kind === 'muldiv') {
    return {
      value: mulDiv(
        BigInt(item.input.value as number),
        BigInt(item.input.numerator as number),
        BigInt(item.input.denominator as number),
        item.input.rounding as 'FLOOR' | 'CEIL' | 'ROUND_HALF_EVEN',
      ).toString(),
    };
  }
  if (item.kind === 'formula') {
    const result = evaluateIssuanceFormula({
      eligibleQuantity: BigInt(item.input.eligible as number),
      categoryWeight: BigInt(item.input.categoryWeight as number),
      claimTypeWeight: BigInt(item.input.claimWeight as number),
      qualityFactor: BigInt(item.input.quality as number),
      roundingMode: item.input.rounding as 'FLOOR' | 'CEIL' | 'ROUND_HALF_EVEN',
      maximumIssuance: BigInt(item.input.maximum as number),
    });
    return {
      uncapped: result.uncappedQuantity.toString(),
      moonrey: result.moonreyQuantity.toString(),
    };
  }
  if (item.kind === 'fingerprint') {
    return {
      hash: contributionFingerprint({
        objectId: String(item.input.objectId),
        measurementPeriodEpoch: Number(item.input.epoch),
        validFromUnixSeconds: BigInt(item.input.validFrom as number),
        validUntilUnixSeconds: BigInt(item.input.validUntil as number),
        claimType: item.input.claimType as 'OUTPUT',
        category: item.input.category as 'ENERGY',
        normalizedQuantity: BigInt(item.input.normalized as number),
        baseUnitId: String(item.input.baseUnit),
        oracleFactIds: String(item.input.facts).split(','),
        upstreamContributionIds: String(item.input.upstream).split(',').filter(Boolean),
      }),
    };
  }
  if (item.kind === 'median') {
    const values = String(item.input.values)
      .split(',')
      .map((part) => BigInt(part));
    return { median: medianOf(values).toString() };
  }
  const address = encodeAddress({
    networkId: 'net_sunrey_simulation',
    addressClass: 'SINGLE_KEY_ACCOUNT',
    algorithm: 'ED25519_V1',
    descriptorBytes: Buffer.from(String(item.input.descriptor), 'utf8'),
  });
  const parsed = parseAddress(address.text, 'net_sunrey_simulation');
  if (!parsed.ok) {
    throw new Error(parsed.detail);
  }
  return { text: address.text, binaryHex: address.binaryHex };
}

export function generateDifferentialCases(seed: number, count: number): DifferentialCase[] {
  const rng = new SeededRng(seed);
  const cases: DifferentialCase[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = rng.pick(['fee', 'muldiv', 'formula', 'fingerprint', 'median'] as const);
    if (kind === 'fee') {
      const input = { encodedBytes: rng.int(80, 800), signatureCount: rng.int(1, 4) };
      const draft = { id: `fee.${i}`, kind, input, expected: {} };
      cases.push({ ...draft, expected: { fee: evaluateDifferentialCase(draft).fee! } });
    } else if (kind === 'muldiv') {
      const input = {
        value: rng.int(0, 10_000),
        numerator: rng.int(0, 1_000_000),
        denominator: rng.int(1, 1_000_000),
        rounding: rng.pick(['FLOOR', 'CEIL', 'ROUND_HALF_EVEN']),
      };
      const draft = { id: `muldiv.${i}`, kind, input, expected: {} };
      cases.push({ ...draft, expected: { value: evaluateDifferentialCase(draft).value! } });
    } else if (kind === 'formula') {
      const input = {
        eligible: rng.int(1, 5_000),
        categoryWeight: rng.int(1, 1_000_000),
        claimWeight: rng.int(1, 1_000_000),
        quality: rng.int(1, 1_000_000),
        rounding: rng.pick(['FLOOR', 'CEIL', 'ROUND_HALF_EVEN']),
        maximum: rng.int(1, 2_000),
      };
      const draft = { id: `formula.${i}`, kind, input, expected: {} };
      const out = evaluateDifferentialCase(draft);
      cases.push({ ...draft, expected: { uncapped: out.uncapped!, moonrey: out.moonrey! } });
    } else if (kind === 'fingerprint') {
      const input = {
        objectId: `obj.${rng.int(1, 9)}`,
        epoch: rng.int(1, 4),
        validFrom: 1_700_000_000,
        validUntil: 1_800_000_000,
        claimType: 'OUTPUT',
        category: 'ENERGY',
        normalized: rng.int(1, 9_000),
        baseUnit: 'kWh',
        facts: rng.shuffle(['a', 'b', 'c']).slice(0, 2).join(','),
        upstream: rng.shuffle(['u1', 'u2']).slice(0, 1).join(','),
      };
      const draft = { id: `fp.${i}`, kind, input, expected: {} };
      cases.push({ ...draft, expected: { hash: evaluateDifferentialCase(draft).hash! } });
    } else {
      const values = Array.from({ length: rng.int(1, 6) }, () => rng.int(1, 500));
      const draft = {
        id: `median.${i}`,
        kind,
        input: { values: values.join(',') },
        expected: {},
      };
      cases.push({ ...draft, expected: { median: evaluateDifferentialCase(draft).median! } });
    }
  }
  return cases;
}

export function assertDifferentialAgreement(item: DifferentialCase): void {
  const actual = evaluateDifferentialCase(item);
  for (const [key, value] of Object.entries(item.expected)) {
    if (actual[key] !== value) {
      throw new Error(`differential ${item.id} ${key}: ${actual[key]} !== ${value}`);
    }
  }
}
