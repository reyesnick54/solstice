import type { HumanInformationNetworkEngine } from './engine.ts';

export const INFORMATION_COMMANDS = [
  'rights',
  'requests',
  'consent',
  'revoke',
  'usage',
  'compensation',
  'clean-room',
  'audit',
  'requester',
  'status',
] as const;

export type InformationCliResult = {
  readonly command: string;
  readonly ok: boolean;
  readonly payload: unknown;
};

export function runInformationCommand(
  engine: HumanInformationNetworkEngine,
  args: readonly string[],
): InformationCliResult {
  const command = args[0] ?? 'status';
  switch (command) {
    case 'rights': {
      const subjectId = args[1] as never;
      return { command, ok: true, payload: subjectId ? engine.getInformationRights(subjectId) : [...engine.store.rights.values()] };
    }
    case 'requests':
      return { command, ok: true, payload: engine.getInformationRequests(args[1]) };
    case 'consent': {
      const grantId = args[1];
      const grant = grantId ? engine.store.grants.get(grantId as never) : [...engine.store.grants.values()][0];
      return { command, ok: Boolean(grant), payload: grant ?? { error: 'CONSENT_UNKNOWN' } };
    }
    case 'revoke': {
      const grantId = args[1];
      if (!grantId) {
        return { command, ok: false, payload: { error: 'GRANT_REQUIRED' } };
      }
      const result = engine.revokeInformationConsent({ grantId: grantId as never });
      return { command, ok: result.ok, payload: result.ok ? result.value : result.error };
    }
    case 'usage':
      return { command, ok: true, payload: engine.getInformationUsage(args[1] as never) };
    case 'compensation':
      return { command, ok: true, payload: engine.getInformationCompensation(args[1] as never) };
    case 'clean-room':
      return { command, ok: true, payload: [...engine.store.jobs.values()] };
    case 'audit':
      return { command, ok: true, payload: engine.audit() };
    case 'requester': {
      const portal = args[1] ? engine.requesterPortal(args[1]) : { ok: false, error: { code: 'REQUESTER_REQUIRED', message: 'requester id required' } };
      return { command, ok: portal.ok, payload: portal.ok ? portal.value : 'error' in portal ? portal.error : portal };
    }
    case 'status':
    default:
      return {
        command: 'status',
        ok: true,
        payload: {
          ...engine.report(),
          production: engine.productionActivation(),
          privacyBudget: engine.privacyBudget(),
        },
      };
  }
}

export function formatInformationCli(result: InformationCliResult): string {
  return JSON.stringify(result.payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}
