import type { PostgresProductionProfile } from './profile.ts';

export type PostgresHealth = {
  readonly ready: boolean;
  readonly writablePrimary: boolean;
  readonly tlsRequired: true;
  readonly authority: 'APPLICATION_ONLY';
  readonly blockchainAuthority: false;
  readonly ledgerAuthorityUnchanged: true;
  readonly notes: string;
};

export function postgresReadiness(profile: PostgresProductionProfile): PostgresHealth {
  const writablePrimary = profile.topology.some((row) => row.role === 'PRIMARY' && row.writable);
  return Object.freeze({
    ready: writablePrimary && profile.tls.enabled && profile.localPitrReady,
    writablePrimary,
    tlsRequired: true,
    authority: 'APPLICATION_ONLY',
    blockchainAuthority: false,
    ledgerAuthorityUnchanged: true,
    notes: 'Engineering readiness. Not a production provider deployment.',
  });
}
