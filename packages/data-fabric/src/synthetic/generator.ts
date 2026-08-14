import { PERSONAL_DATA_CATEGORIES, type PersonalDataCategory } from '@solstice/kernel';

import { classifySyntheticWrite, type ClassifiedSyntheticRecord } from '../vault/record.ts';

const FIRST = ['Avery', 'Blair', 'Casey', 'Drew', 'Eden', 'Finley', 'Gray', 'Harper'] as const;
const LAST = ['Calder', 'Ellison', 'Fenwick', 'Hadley', 'Iver', 'Lang', 'Moss', 'Quill'] as const;

/**
 * Fabricates records for every vault category. Values are obviously fake
 * (SYNTH- prefixes). The type brand is SYNTHETIC; a REAL record cannot
 * be produced by this generator.
 */
export function generateSyntheticPopulation(input: {
  readonly subjectCount: number;
  readonly classifiedAt: string;
}): readonly ClassifiedSyntheticRecord[] {
  const records: ClassifiedSyntheticRecord[] = [];
  for (let i = 0; i < input.subjectCount; i += 1) {
    const subjectRef = `SYNTH-SUBJECT-${String(i + 1).padStart(4, '0')}`;
    for (const category of PERSONAL_DATA_CATEGORIES) {
      records.push(
        classifySyntheticWrite({
          recordId: `syn_${category.toLowerCase()}_${String(i + 1).padStart(4, '0')}`,
          subjectRef,
          category,
          attributes: attributesFor(category, i, subjectRef),
          classifiedAt: input.classifiedAt,
          provenance: 'SYNTHETIC',
        }),
      );
    }
  }
  return Object.freeze(records);
}

function attributesFor(
  category: PersonalDataCategory,
  index: number,
  subjectRef: string,
): Readonly<Record<string, string | bigint>> {
  const bucket = BigInt((index % 4) + 1);
  switch (category) {
    case 'IDENTITY':
      return {
        displayName: `SYNTH-${FIRST[index % FIRST.length]}-${LAST[index % LAST.length]}`,
        locale: 'en-US-SYNTH',
      };
    case 'FINANCIAL':
      return { syntheticBalanceBand: bucket, currency: 'USD' };
    case 'HEALTH':
      return { restingHeartBand: 50n + bucket * 4n, sleepHoursBand: 6n + (bucket % 3n) };
    case 'WELLNESS':
      return { stepsBand: 4000n + bucket * 1000n, mindfulnessMinutesBand: bucket * 5n };
    case 'CONSUMPTION':
      return { groceryTripsBand: bucket, category: 'SYNTH-GROCERY' };
    case 'ENTERTAINMENT':
      return { streamHoursBand: bucket, genre: 'SYNTH-DOCUMENTARY' };
    case 'WORK':
      return { remoteDaysBand: bucket, roleFamily: 'SYNTH-ANALYST' };
    case 'LIFESTYLE':
      return { commuteBand: bucket, housing: 'SYNTH-RENTAL' };
    case 'GOALS':
      return { savingsGoalBand: bucket * 100n, label: 'SYNTH-EMERGENCY-RESERVE' };
    case 'PSYCHOLOGICAL':
      return { stressBand: bucket, instrument: 'SYNTH-SCALE-NOT-CLINICAL' };
    case 'PREFERENCES':
      return { contactChannel: 'SYNTH-EMAIL', theme: 'SYNTH-DARK' };
    case 'PURCHASE_INTENT':
      return { intentBand: bucket, merchantClass: 'SYNTH-SPORTING' };
    default: {
      const _never: never = category;
      return _never;
    }
  }
}

export function syntheticSubjectRefs(count: number): readonly string[] {
  return Object.freeze(
    Array.from({ length: count }, (_, i) => `SYNTH-SUBJECT-${String(i + 1).padStart(4, '0')}`),
  );
}
