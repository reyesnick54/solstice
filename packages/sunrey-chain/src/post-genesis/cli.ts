/**
 * sunrey-mainnet stabilization and capability commands.
 *
 * CI uses the rehearsal environment. Commands never launch production.
 */

import {
  assembleActivationPackage,
  evidenceFor,
} from './capabilities.ts';
import { captureCheckpoint, protocolCoordinate } from './checkpoints.ts';
import { auditSupply, auditValidatorEconomics, rehearsalSupply, rehearsalValidatorEconomics } from './economics.ts';
import { publicNetworkStatus, stripSecurityInternals } from './explorer.ts';
import { jsonSafe } from './hash.ts';
import { composeHealthReport, healthyObservation } from './health.ts';
import { defaultPostGenesisPolicy, REHEARSAL_PROTOCOL } from './identity.ts';
import {
  activateCapability,
  initialStabilizationState,
  recordCheckpoint,
  restrictCapability,
} from './plane.ts';
import {
  runAllPostGenesisRehearsals,
  runNegativeActivationSuite,
  runPostGenesisRehearsal,
  walkHealthyEpochs,
} from './rehearsal.ts';
import { buildStabilizationReport } from './report.ts';
import type { IndependentCapability } from './types.ts';
import { INDEPENDENT_CAPABILITIES } from './types.ts';

export type StabilizationCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function runStabilizationCommand(argv: readonly string[]): StabilizationCliResult {
  const [family = 'help', command = '', ...rest] = argv;
  if (family === 'rehearsal') {
    const scenario = (rest[0] ?? command ?? 'healthy-first-epochs') as Parameters<typeof runPostGenesisRehearsal>[0];
    const result = command === 'all' || rest[0] === 'all'
      ? { all: runAllPostGenesisRehearsals().map(publicRehearsal) }
      : publicRehearsal(runPostGenesisRehearsal(scenario));
    return { ok: true, command: 'rehearsal', payload: jsonSafe(result) };
  }
  if (family === 'stabilization') {
    return stabilizationFamily(command, rest);
  }
  if (family === 'capability') {
    return capabilityFamily(command, rest);
  }
  return help();
}

function stabilizationFamily(command: string, rest: readonly string[]): StabilizationCliResult {
  const policy = defaultPostGenesisPolicy();
  const state = command === 'audit'
    ? walkHealthyEpochs(initialStabilizationState(policy))
    : initialStabilizationState(policy);
  if (command === 'status') {
    return {
      ok: true,
      command: 'stabilization status',
      payload: jsonSafe({
        ...stripSecurityInternals(
          publicNetworkStatus({
            phase: state.phase,
            health: state.latestHealth,
            enabled: state.enabled,
            restricted: state.restricted,
          }),
        ),
        report: buildStabilizationReport(state),
      }),
    };
  }
  if (command === 'checkpoint') {
    const height = Number.parseInt(rest[0] ?? '1', 10);
    const epoch = Number.parseInt(rest[1] ?? '0', 10);
    const root = rest[2] ?? 'aaaaaaaa';
    const next = recordCheckpoint(initialStabilizationState(policy), {
      height,
      epoch,
      finalizedStateRoot: root,
    });
    const coordinate = protocolCoordinate(height, epoch, root);
    const checkpoint = next.latestCheckpoint ?? captureCheckpoint(policy, policy.initialPhase, coordinate);
    const health = next.latestHealth ?? composeHealthReport(checkpoint, healthyObservation());
    return {
      ok: true,
      command: 'stabilization checkpoint',
      payload: jsonSafe({ checkpoint, health, configured: policy.checkpointHeights.includes(height) }),
    };
  }
  if (command === 'audit') {
    const checkpoint = state.latestCheckpoint;
    if (!checkpoint) {
      return { ok: false, command: 'stabilization audit', payload: { error: 'no checkpoint' } };
    }
    return {
      ok: true,
      command: 'stabilization audit',
      payload: jsonSafe({
        supply: state.economicAudit ?? auditSupply(checkpoint, rehearsalSupply()),
        validatorEconomics: state.validatorAudit ?? auditValidatorEconomics(checkpoint, rehearsalValidatorEconomics()),
        feeMarket: state.latestHealth?.feeMarket ?? null,
        moonrey: { productiveIssuance: 'EXPLICITLY_DISABLED', requiresOwnCapabilityPackage: true },
        treasury: { genesisAuthorizesSpending: false, requiresGovernanceAuthorization: true },
      }),
    };
  }
  return help();
}

function capabilityFamily(command: string, rest: readonly string[]): StabilizationCliResult {
  const policy = defaultPostGenesisPolicy();
  if (command === 'list') {
    return {
      ok: true,
      command: 'capability list',
      payload: jsonSafe({
        capabilities: INDEPENDENT_CAPABILITIES.map((capability) => ({
          capability,
          runtimeEnabled: false,
          independent: true,
        })),
        chainMayBeHealthyWhileExchangeUnavailable: true,
      }),
    };
  }
  if (command === 'evidence') {
    const capability = parseCapability(rest[0]);
    return {
      ok: Boolean(capability),
      command: 'capability evidence',
      payload: jsonSafe(capability ? evidenceFor(capability) : { error: 'unknown capability' }),
    };
  }
  if (command === 'verify' || command === 'activate') {
    const capability = parseCapability(rest[0]) ?? 'SUNREY_EXCHANGE';
    const actor = rest.includes('--ai') ? 'AI' : 'HUMAN';
    const network = rest.includes('--wrong-network') ? 'net_wrong' : policy.networkId;
    let state = walkHealthyEpochs(initialStabilizationState(policy));
    const pkg = assembleActivationPackage({
      capability,
      policy,
      networkId: network,
      humanAuthority: [
        {
          actorKind: actor,
          actorId: actor === 'HUMAN' ? 'human-rehearsal' : 'ai-analyst',
          role: actor === 'HUMAN' ? 'OPERATIONS_AUTHORITY' : 'AI_ANALYST',
          statement: 'cli verify/activate',
          signedAtUtc: '2026-08-18T00:00:00.000Z',
          accepted: true,
        },
      ],
    });
    const result = activateCapability(state, pkg);
    return {
      ok: command === 'verify' ? true : result.result.outcome === 'ACTIVATED',
      command: `capability ${command}`,
      payload: jsonSafe({ package: pkg, result: result.result, realProductionCapabilitiesActivated: false }),
    };
  }
  if (command === 'restrict') {
    const capability = parseCapability(rest[0]) ?? 'SUNREY_EXCHANGE';
    const action = rest[1] ?? 'RESTRICT_NEW_EXCHANGE_ORDERS';
    const result = restrictCapability(initialStabilizationState(policy), capability, action);
    return {
      ok: result.ok,
      command: 'capability restrict',
      payload: jsonSafe({ capability, action, ok: result.ok, reason: result.reason }),
    };
  }
  if (command === 'history') {
    const suite = runNegativeActivationSuite();
    return {
      ok: true,
      command: 'capability history',
      payload: jsonSafe({
        history: Object.entries(suite).map(([name, row]) => ({
          name,
          result: row.outcome,
          reasons: row.reasons,
        })),
      }),
    };
  }
  return help();
}

function parseCapability(raw: string | undefined): IndependentCapability | null {
  if (!raw) {
    return null;
  }
  return (INDEPENDENT_CAPABILITIES as readonly string[]).includes(raw) ? (raw as IndependentCapability) : null;
}

function publicRehearsal(result: ReturnType<typeof runPostGenesisRehearsal>): unknown {
  return {
    scenario: result.scenario,
    deterministic: result.deterministic,
    phase: result.report.phase,
    realProductionCapabilitiesActivated: false,
    negatives: result.negatives,
    capabilities: result.report.capabilities,
  };
}

function help(): StabilizationCliResult {
  return {
    ok: true,
    command: 'help',
    payload: {
      usage: [
        'sunrey-mainnet stabilization status',
        'sunrey-mainnet stabilization checkpoint [height epoch stateRoot]',
        'sunrey-mainnet stabilization audit',
        'sunrey-mainnet capability list',
        'sunrey-mainnet capability evidence <CAPABILITY>',
        'sunrey-mainnet capability verify <CAPABILITY>',
        'sunrey-mainnet capability activate <CAPABILITY>',
        'sunrey-mainnet capability restrict <CAPABILITY> [ACTION]',
        'sunrey-mainnet capability history',
      ],
      protocolVersion: REHEARSAL_PROTOCOL,
      realProductionCapabilitiesActivated: false,
    },
  };
}
