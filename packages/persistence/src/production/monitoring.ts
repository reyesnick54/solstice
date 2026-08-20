export type ApplicationStorageMetrics = {
  readonly postgres_size: bigint;
  readonly storage_write_latency: bigint;
  readonly storage_read_latency: bigint;
  readonly storage_errors: bigint;
  readonly remaining_capacity: bigint;
};

export type CapacityGuard = {
  readonly code: 'DISK_EXHAUSTION' | 'WAL_GROWTH' | 'SNAPSHOT_EXHAUSTION' | 'DATABASE_STORAGE_EXHAUSTION' | 'LOG_GROWTH';
  readonly warn: boolean;
  readonly message: string;
};

export function evaluateCapacity(input: {
  readonly usedBytes: bigint;
  readonly capacityBytes: bigint;
  readonly walBytes: bigint;
  readonly snapshotBytes: bigint;
  readonly logBytes: bigint;
  readonly postgresBytes: bigint;
  readonly warnRatio: number;
}): readonly CapacityGuard[] {
  const ratio = input.capacityBytes === 0n ? 1 : Number(input.usedBytes) / Number(input.capacityBytes);
  const guards: CapacityGuard[] = [];
  if (ratio >= input.warnRatio) {
    guards.push({
      code: 'DISK_EXHAUSTION',
      warn: true,
      message: 'disk usage exceeds the production-candidate warn threshold',
    });
  }
  if (input.walBytes * 10n > input.capacityBytes) {
    guards.push({ code: 'WAL_GROWTH', warn: true, message: 'WAL growth is consuming a large fraction of capacity' });
  }
  if (input.snapshotBytes * 4n > input.capacityBytes) {
    guards.push({
      code: 'SNAPSHOT_EXHAUSTION',
      warn: true,
      message: 'snapshots are approaching unsafe capacity',
    });
  }
  if (input.postgresBytes * 2n > input.capacityBytes) {
    guards.push({
      code: 'DATABASE_STORAGE_EXHAUSTION',
      warn: true,
      message: 'application PostgreSQL size is approaching capacity',
    });
  }
  if (input.logBytes * 20n > input.capacityBytes) {
    guards.push({
      code: 'LOG_GROWTH',
      warn: true,
      message: 'logging must not consume unrestricted disk',
    });
  }
  return Object.freeze(guards);
}

export function loggingBounded(maxLogBytes: bigint, usedLogBytes: bigint): boolean {
  return usedLogBytes <= maxLogBytes;
}

export function operationalBackupScope(): readonly string[] {
  return Object.freeze([
    'payments.operational_payment',
    'payments.operational_rail_submission',
    'payments.operational_fx_execution',
    'custody.operational_vault',
    'custody.operational_wallet',
    'custody.operational_withdrawal',
    'custody.operational_deposit',
    'custody.operational_reservation',
    'custody.operational_provider_submission',
    'sunrey_exchange.operational_order',
    'sunrey_exchange.operational_reservation',
    'sunrey_exchange.operational_trade',
    'sunrey_exchange.operational_settlement_intent',
    'customer.provider_operational_state',
    'customer.operational_outbox',
    'customer.operational_inbox',
    'security.credential_descriptor_ref',
  ]);
}
