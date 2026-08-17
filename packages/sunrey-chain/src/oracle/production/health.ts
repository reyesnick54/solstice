import type { OracleAlert, OracleAlertKind, ProviderHealthSnapshot } from './types.ts';

export class OracleHealthMonitor {
  private readonly snapshots = new Map<string, ProviderHealthSnapshot>();
  private readonly alerts: OracleAlert[] = [];

  record(snapshot: ProviderHealthSnapshot, nowUnix: bigint): readonly OracleAlert[] {
    this.snapshots.set(snapshot.providerId, snapshot);
    const raised: OracleAlert[] = [];
    const raise = (kind: OracleAlertKind, detail: string) => {
      const alert = Object.freeze({
        kind,
        providerId: snapshot.providerId,
        feedId: null,
        sourceId: null,
        detail,
        atUnix: nowUnix,
      });
      raised.push(alert);
      this.alerts.push(alert);
    };
    if (!snapshot.authenticationOk) {
      raise('ORACLE_SOURCE_AUTH_FAILURE', 'collector authentication failed');
    }
    if (snapshot.schemaErrors > 0) {
      raise('ORACLE_SCHEMA_CHANGED', 'schema validation errors recorded');
    }
    if (!snapshot.sourceFresh) {
      raise('ORACLE_SOURCE_STALE', 'source observation exceeded freshness policy');
    }
    if (!snapshot.quorumAvailable) {
      raise('ORACLE_QUORUM_DEGRADED', 'quorum is unavailable; fact creation fails closed');
    }
    if (snapshot.signatureErrors > 0) {
      raise('ORACLE_SIGNATURE_FAILURE', 'oracle signature verification failed');
    }
    if (snapshot.conflictRateBps > 2_500) {
      raise('ORACLE_SOURCE_CONFLICT', `conflict rate ${snapshot.conflictRateBps} bps`);
    }
    return raised;
  }

  raise(alert: OracleAlert): void {
    this.alerts.push(alert);
  }

  get(providerId: string): ProviderHealthSnapshot | undefined {
    return this.snapshots.get(providerId);
  }

  listAlerts(kind?: OracleAlertKind): readonly OracleAlert[] {
    return this.alerts.filter((row) => (kind ? row.kind === kind : true));
  }

  list(): readonly ProviderHealthSnapshot[] {
    return [...this.snapshots.values()].sort((a, b) => (a.providerId < b.providerId ? -1 : 1));
  }
}
