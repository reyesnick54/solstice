/**
 * sunrey-ops validator fleet|operator|enrollment|health|maintenance|
 * upgrade|rotate-key|backup|incidents|concentration
 *
 * Workload/user authorized. Never prints private key material.
 */

import { assertNoPrivateKeyMaterial } from '../ops/logging.ts';
import { OPERATOR_A_ID, defaultAdmin, operatorUsage, ValidatorOperatorPlatform } from './platform.ts';
import { fixturePrincipal } from './fixtures.ts';
import type { OperatorApiResponse, OperatorPrincipal, OperatorRole } from './types.ts';

export const VALIDATOR_OPERATOR_COMMANDS = [
  'fleet',
  'operator',
  'enrollment',
  'health',
  'maintenance',
  'upgrade',
  'rotate-key',
  'backup',
  'incidents',
  'concentration',
  'dashboard',
  'report',
  'help',
] as const;

export type ValidatorOperatorCliResult = OperatorApiResponse;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

function principalFromEnv(): OperatorPrincipal {
  const operatorId = process.env.SUNREY_OPERATOR_ID === 'op_beta' ? 'op_beta' : OPERATOR_A_ID;
  const role = (process.env.SUNREY_OPERATOR_ROLE ?? 'OPERATOR_ADMIN') as OperatorRole;
  const kind = process.env.SUNREY_OPERATOR_KIND === 'AI' ? 'AI' : 'HUMAN';
  return fixturePrincipal(operatorId, role, kind);
}

export function runValidatorOperatorCommand(
  argv: readonly string[],
  platform = new ValidatorOperatorPlatform(),
  principal = principalFromEnv(),
): ValidatorOperatorCliResult {
  const [command = 'help', extra] = argv;
  if (command === 'help' || !(VALIDATOR_OPERATOR_COMMANDS as readonly string[]).includes(command as (typeof VALIDATOR_OPERATOR_COMMANDS)[number])) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage: operatorUsage(),
        simulation: true,
        sharedAdminSecret: false,
        canonicalSetAuthoritative: true,
      },
    };
  }

  if (command === 'maintenance' && extra === 'plan-one') {
    const planned = platform.planMaintenance(principal, [principal.operatorId === 'op_beta' ? 'val_op_e' : 'val_op_a'], 'one-node rehearsal');
    return finish('maintenance', planned);
  }
  if (command === 'upgrade' && extra === 'plan') {
    const batch = principal.operatorId === 'op_beta' ? ['val_op_e'] : ['val_op_a'];
    const planned = platform.planUpgrade(principal, {
      release: 'sunrey-node/1.1.0',
      artifactDigest: 'digest-1.1.0',
      protocolVersion: '2',
      batch,
    });
    return finish('upgrade', planned);
  }
  if (command === 'rotate-key' && extra === 'prepare') {
    const validatorId = principal.operatorId === 'op_beta' ? 'val_op_e' : 'val_op_a';
    const prepared = platform.prepareRotation(principal, validatorId, 'next-fingerprint', false);
    return finish('rotate-key', prepared);
  }
  if (command === 'backup' && extra === 'create') {
    const validatorId = principal.operatorId === 'op_beta' ? 'val_op_e' : 'val_op_a';
    const created = platform.createBackup(principal, validatorId, 'SNAPSHOT');
    return finish('backup', created);
  }
  if (command === 'incidents' && extra === 'open') {
    const validatorId = principal.operatorId === 'op_beta' ? 'val_op_e' : 'val_op_a';
    const opened = platform.openIncident(principal, validatorId, 'NODE_FAILURE', 'rehearsal catalog', null);
    return finish('incidents', opened);
  }
  if (command === 'enrollment' && extra === 'start') {
    const enrolled = platform.enroll(principal, principal.operatorId === 'op_beta' ? 'val_op_e' : 'val_op_a');
    return finish('enrollment', enrolled);
  }

  return finish(command, platform.api(principal, command));
}

function finish(command: string, result: { readonly ok: boolean; readonly value?: unknown; readonly payload?: unknown; readonly code?: string; readonly message?: string }): ValidatorOperatorCliResult {
  const payload = 'payload' in result && result.payload !== undefined ? result.payload : result.ok ? result.value ?? result : result;
  const safe = jsonSafe(payload);
  assertNoPrivateKeyMaterial(safe);
  return { ok: result.ok, command, payload: safe };
}

export function defaultOperatorPrincipal(): OperatorPrincipal {
  return defaultAdmin();
}

export { operatorUsage };
