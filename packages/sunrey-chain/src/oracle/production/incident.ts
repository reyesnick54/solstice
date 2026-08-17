import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { commitCanonical } from '../../hash.ts';
import { OracleOnboardingRegistry, transitionOnboarding } from './onboarding.ts';
import type { IncidentAction, ProductionOracleRejection } from './types.ts';

export type IncidentActorKind = 'HUMAN' | 'AI' | 'AGENT' | 'AUTOMATION';

export type OracleIncidentRecord = {
  readonly schemaVersion: 1;
  readonly incidentId: string;
  readonly providerId: string;
  readonly action: IncidentAction;
  readonly actorKind: IncidentActorKind;
  readonly actorId: string;
  readonly evidenceRef: string;
  readonly atUnix: bigint;
  readonly approved: boolean;
};

export class OracleIncidentControl {
  private readonly incidents: OracleIncidentRecord[] = [];

  private readonly onboarding: OracleOnboardingRegistry;

  constructor(onboarding: OracleOnboardingRegistry) {
    this.onboarding = onboarding;
  }

  apply(input: {
    readonly incidentId: string;
    readonly providerId: string;
    readonly action: IncidentAction;
    readonly actorKind: IncidentActorKind;
    readonly actorId: string;
    readonly evidenceRef: string;
    readonly atUnix: bigint;
  }): Result<OracleIncidentRecord, ProductionOracleRejection> {
    const record = this.onboarding.get(input.providerId);
    if (!record) {
      return err({ code: 'PROVIDER_NOT_ONBOARDED', detail: input.providerId });
    }
    if (input.action === 'RESUMPTION_APPROVAL') {
      if (input.actorKind !== 'HUMAN') {
        return err({
          code: 'AI_CANNOT_RESTORE_PROVIDER',
          detail: 'AI cannot independently restore a suspended production provider',
        });
      }
      if (record.status !== 'SUSPENDED') {
        return err({ code: 'PROVIDER_NOT_ELIGIBLE', detail: 'only suspended providers can be resumed' });
      }
      const resumed = transitionOnboarding(record, 'TESTNET_ACTIVE');
      if (!resumed.ok) {
        return resumed;
      }
      this.onboarding.put(resumed.value);
    }
    if (input.action === 'PROVIDER_SUSPENSION') {
      const suspended = transitionOnboarding(record, 'SUSPENDED');
      if (!suspended.ok) {
        return suspended;
      }
      this.onboarding.put(suspended.value);
    }
    const incident: OracleIncidentRecord = Object.freeze({
      schemaVersion: 1,
      incidentId: input.incidentId,
      providerId: input.providerId,
      action: input.action,
      actorKind: input.actorKind,
      actorId: input.actorId,
      evidenceRef: input.evidenceRef,
      atUnix: input.atUnix,
      approved: input.action !== 'RESUMPTION_APPROVAL' || input.actorKind === 'HUMAN',
    });
    this.incidents.push(incident);
    return ok(incident);
  }

  list(): readonly OracleIncidentRecord[] {
    return [...this.incidents];
  }

  evidenceHash(): string {
    return commitCanonical({
      domain: 'sunrey.oracle.incident.v1',
      incidents: this.incidents.map((row) => row.incidentId),
    });
  }
}
