import { evaluationMoney } from './money.ts';
import type { EvaluationMoney, HiddenCapitalFinding } from './types.ts';

export function detectHiddenCapital(input: {
  readonly startCapital: EvaluationMoney;
  readonly endingCapital: EvaluationMoney;
  readonly declaredDeposits: readonly EvaluationMoney[];
  readonly netResultMinor: string;
  readonly researchCostMinor: string;
  readonly hiddenCapitalEvents?: readonly HiddenCapitalFinding[];
}): readonly HiddenCapitalFinding[] {
  const findings: HiddenCapitalFinding[] = [...(input.hiddenCapitalEvents ?? [])];
  const declaredDepositTotal = input.declaredDeposits.reduce(
    (acc, row) => acc + BigInt(row.minorUnits),
    0n,
  );
  const expectedEnding =
    BigInt(input.startCapital.minorUnits) + BigInt(input.netResultMinor) + declaredDepositTotal;
  const actualEnding = BigInt(input.endingCapital.minorUnits);
  if (actualEnding > expectedEnding) {
    findings.push(
      Object.freeze({
        detected: true,
        kind: 'ADDITIONAL_DEPOSIT',
        amount: evaluationMoney((actualEnding - expectedEnding).toString(), input.endingCapital.currency),
        message: 'ending capital exceeds start + declared deposits + net result; possible hidden capital',
      }),
    );
  }
  return Object.freeze(findings);
}

export function rejectHiddenCapital(findings: readonly HiddenCapitalFinding[]): {
  readonly ok: boolean;
  readonly findings: readonly HiddenCapitalFinding[];
} {
  const detected = findings.filter((row) => row.detected);
  return Object.freeze({
    ok: detected.length === 0,
    findings: Object.freeze(detected),
  });
}
