import type { SimulationRuntime } from '../../../accounts/src/runtime.ts';

/**
 * Keeps SIMULATED actors usable when the hosted runtime runs on a wall clock.
 *
 * The hosted sandbox historically ran on a FrozenClock, so the service actor
 * (`operator_1`, which sponsors the labelled sandbox faucet) and the sandbox
 * persona actors never aged. On SUNREY_RUNTIME_CLOCK=SYSTEM their 8-hour
 * sessions and 24-hour capability grants expire in real time, after which the
 * Compliance Kernel correctly refuses them ("actor session is missing or
 * invalid", "actor lacks capability").
 *
 * This renews only actors the simulation provisioned itself: `operator_1`
 * and `actor_sandbox_*`. It never touches a self-registered customer, never
 * adds a capability the actor did not already hold, and never revives a
 * suspended, locked, or closed identity. Re-authentication uses the existing
 * simulated passkey ceremony, so every renewed session still passes through
 * IdentityService and seals the same evidence as the original provisioning.
 */

const SIMULATED_ACTOR = /^(operator_1|actor_sandbox_[a-z0-9_]+)$/;
const SESSION_RENEW_BEFORE_MS = 60 * 60 * 1000; // renew when < 1h remains
const GRANT_RENEW_BEFORE_MS = 2 * 60 * 60 * 1000; // renew when < 2h remains

export type SimulatedActorFreshnessReport = {
  readonly schema: 'sunrey.simulated-actor-freshness.v1';
  readonly checkedActors: number;
  readonly sessionsRenewed: number;
  readonly grantsRenewed: number;
  readonly skippedInactive: number;
};

type Runtime = Pick<SimulationRuntime, 'identity' | 'clock'>;

function remainingMs(expiresAt: string, now: string): number {
  return Date.parse(expiresAt) - Date.parse(now);
}

export function refreshSimulatedActors(runtime: Runtime): SimulatedActorFreshnessReport {
  const service = runtime.identity.service;
  const now = runtime.clock.now();

  // actorId -> { identityId, strongest prior assurance }
  const actors = new Map<string, { identityId: string; highAssurance: boolean }>();
  for (const session of service.store.sessions.values()) {
    if (!SIMULATED_ACTOR.test(session.actorId)) continue;
    const prior = actors.get(session.actorId);
    const high = session.authenticationStrength === 'HIGH_ASSURANCE';
    actors.set(session.actorId, {
      identityId: session.subjectId,
      highAssurance: Boolean(prior?.highAssurance) || high,
    });
  }

  let sessionsRenewed = 0;
  let grantsRenewed = 0;
  let skippedInactive = 0;

  for (const [actorId, { identityId, highAssurance }] of actors) {
    const person = service.store.identities.get(identityId);
    if (!person || person.status !== 'ACTIVE') {
      skippedInactive += 1;
      continue;
    }

    // Capability grants first: renew only capabilities this identity already held.
    const byCapability = new Map<string, { expiresAt: string | null; source: string; revoked: boolean }[]>();
    for (const grant of service.store.grants.values()) {
      if (grant.identityId !== identityId) continue;
      const rows = byCapability.get(grant.capability) ?? [];
      rows.push({
        expiresAt: (grant as { expiresAt?: string | null }).expiresAt ?? null,
        source: grant.source,
        revoked: Boolean((grant as { revokedAt?: string | null }).revokedAt),
      });
      byCapability.set(grant.capability, rows);
    }
    for (const [capability, rows] of byCapability) {
      if (rows.every((row) => row.revoked)) continue; // deliberately revoked: leave it
      const best = Math.max(
        ...rows.filter((row) => !row.revoked).map((row) => (row.expiresAt === null ? Infinity : remainingMs(row.expiresAt, now))),
      );
      if (best > GRANT_RENEW_BEFORE_MS) continue;
      const source = rows.find((row) => !row.revoked)?.source ?? 'IDENTITY_SERVICE';
      const granted = service.grantCapability(identityId as never, capability as never, source as never);
      if (granted.ok) grantsRenewed += 1;
    }

    const active = service.activeSessionForActor(actorId);
    if (active && remainingMs(active.expiresAt, now) > SESSION_RENEW_BEFORE_MS) continue;
    const renewed = runtime.identity.enrollAndAuthenticate(identityId as never, actorId, 'sim-device-1', highAssurance);
    if (renewed.ok) sessionsRenewed += 1;
  }

  return Object.freeze({
    schema: 'sunrey.simulated-actor-freshness.v1',
    checkedActors: actors.size,
    sessionsRenewed,
    grantsRenewed,
    skippedInactive,
  });
}
