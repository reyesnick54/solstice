export type VotingPowerView = {
  readonly totalPower: bigint;
  readonly oneThirdPower: bigint;
  readonly twoThirdsPower: bigint;
};

function asU128(value: bigint, label: string): bigint {
  if (value < 0n) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  if (value > (1n << 128n) - 1n) {
    throw new TypeError(`${label} overflows u128`);
  }
  return value;
}

export function totalPower(powers: readonly bigint[]): bigint {
  let total = 0n;
  for (const power of powers) {
    const next = asU128(total, 'total') + asU128(power, 'votingPower');
    if (next > (1n << 128n) - 1n) {
      throw new TypeError('total voting power overflows u128');
    }
    total = next;
  }
  return total;
}

export function oneThirdPower(total: bigint): bigint {
  return asU128(total, 'total') / 3n;
}

export function twoThirdsPower(total: bigint): bigint {
  return (asU128(total, 'total') * 2n) / 3n;
}

/** signed * 3 > total  (strict one-third-plus) */
export function hasOneThirdPlus(signed: bigint, total: bigint): boolean {
  return asU128(signed, 'signed') * 3n > asU128(total, 'total');
}

/** signed * 3 > total * 2  (strict two-thirds-plus) */
export function hasTwoThirdsPlus(signed: bigint, total: bigint): boolean {
  return asU128(signed, 'signed') * 3n > asU128(total, 'total') * 2n;
}

export function votingPowerView(powers: readonly bigint[]): VotingPowerView {
  const total = totalPower(powers);
  return Object.freeze({
    totalPower: total,
    oneThirdPower: oneThirdPower(total),
    twoThirdsPower: twoThirdsPower(total),
  });
}
