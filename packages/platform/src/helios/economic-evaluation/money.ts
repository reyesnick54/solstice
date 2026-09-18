import type { EvaluationMoney } from './types.ts';

export function evaluationMoney(minorUnits: string, currency: string): EvaluationMoney {
  return Object.freeze({ minorUnits, currency });
}

export function sumMoney(rows: readonly EvaluationMoney[]): EvaluationMoney {
  if (rows.length === 0) {
    return evaluationMoney('0', 'USD');
  }
  const currency = rows[0]?.currency ?? 'USD';
  const total = rows.reduce((acc, row) => {
    if (row.currency !== currency) {
      throw new Error(`currency mismatch: ${row.currency} vs ${currency}`);
    }
    return acc + BigInt(row.minorUnits);
  }, 0n);
  return evaluationMoney(total.toString(), currency);
}

export function subtractMoney(left: EvaluationMoney, right: EvaluationMoney): EvaluationMoney {
  if (left.currency !== right.currency) {
    throw new Error(`currency mismatch: ${left.currency} vs ${right.currency}`);
  }
  return evaluationMoney((BigInt(left.minorUnits) - BigInt(right.minorUnits)).toString(), left.currency);
}

export function addMoney(left: EvaluationMoney, right: EvaluationMoney): EvaluationMoney {
  if (left.currency !== right.currency) {
    throw new Error(`currency mismatch: ${left.currency} vs ${right.currency}`);
  }
  return evaluationMoney((BigInt(left.minorUnits) + BigInt(right.minorUnits)).toString(), left.currency);
}

export function medianMinor(values: readonly string[]): string {
  if (values.length === 0) {
    return '0';
  }
  const sorted = [...values].map((v) => BigInt(v)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]?.toString() ?? '0';
  }
  const lower = sorted[mid - 1] ?? 0n;
  const upper = sorted[mid] ?? 0n;
  return ((lower + upper) / 2n).toString();
}

export function meanMinor(values: readonly string[]): string {
  if (values.length === 0) {
    return '0';
  }
  const total = values.reduce((acc, row) => acc + BigInt(row), 0n);
  return (total / BigInt(values.length)).toString();
}

export function varianceMinorSquared(values: readonly string[]): string {
  if (values.length <= 1) {
    return '0';
  }
  const nums = values.map((v) => BigInt(v));
  const avg = nums.reduce((acc, row) => acc + row, 0n) / BigInt(nums.length);
  const sumSq = nums.reduce((acc, row) => {
    const diff = row - avg;
    return acc + diff * diff;
  }, 0n);
  return (sumSq / BigInt(nums.length - 1)).toString();
}
