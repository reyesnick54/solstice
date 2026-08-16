import { writeFileSync } from 'node:fs';

import { MachineEconomyEngine, isRejection } from './engine.ts';
import type { MachineCapability, ServiceCategory } from './types.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'register',
  'show',
  'capabilities',
  'mandate',
  'offers',
  'purchase',
  'escrow',
  'metering',
  'delivery',
  'settlement',
  'revoke',
] as const;

export function machineUsage(): string {
  return [
    'sunrey-node machine register <machineId> <machineType> <controller>',
    'sunrey-node machine show <machineId>',
    'sunrey-node machine capabilities <machineId>',
    'sunrey-node machine mandate <machineId>',
    'sunrey-node machine offers',
    'sunrey-node machine purchase <orderId>',
    'sunrey-node machine escrow <orderId>',
    'sunrey-node machine metering <sessionId>',
    'sunrey-node machine delivery <proofId>',
    'sunrey-node machine settlement <settlementId>',
    'sunrey-node machine revoke <machineId> <controller> <reason>',
  ].join('\n');
}

export function runMachineCommand(engine: MachineEconomyEngine, args: readonly string[]): CliResult {
  const command = args[0];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown machine command', usage: machineUsage() } };
  }
  switch (command) {
    case 'register': {
      const [machineId, machineType, controller] = args.slice(1);
      if (!machineId || !machineType || !controller) {
        return { ok: false, command, payload: { error: 'usage: machine register <id> <type> <controller>' } };
      }
      const result = engine.register({
        machineId,
        machineType: machineType as 'AI_AGENT',
        ownerActor: controller,
        controllerActor: controller,
        hardwareIdentityRef: `hw.${machineId}`,
        softwareModelRef: `sw.${machineId}`,
        firmwareHash: 'fw',
        modelHash: 'md',
        jurisdiction: 'SIM-DEV',
        seedLabel: machineId,
      });
      return { ok: !isRejection(result), command, payload: result };
    }
    case 'show': {
      const machine = engine.getIdentity(args[1] ?? '');
      return { ok: Boolean(machine), command, payload: machine ?? { error: 'not found' } };
    }
    case 'capabilities': {
      const machine = engine.getIdentity(args[1] ?? '');
      return { ok: Boolean(machine), command, payload: machine?.capabilityManifest ?? { error: 'not found' } };
    }
    case 'mandate': {
      const machine = engine.getIdentity(args[1] ?? '');
      return {
        ok: Boolean(machine),
        command,
        payload: machine
          ? { spending: machine.spendingMandate, resource: machine.resourceMandate }
          : { error: 'not found' },
      };
    }
    case 'offers':
      return { ok: true, command, payload: engine.listOffers() };
    case 'purchase': {
      const order = engine.getOrder(args[1] ?? '');
      return { ok: Boolean(order), command, payload: order ?? { error: 'not found' } };
    }
    case 'escrow': {
      const escrow = engine.escrowForOrder(args[1] ?? '') ?? engine.getEscrow(args[1] ?? '');
      return { ok: Boolean(escrow), command, payload: escrow ?? { error: 'not found' } };
    }
    case 'metering': {
      const session = engine.getSession(args[1] ?? '') ?? engine.sessionForOrder(args[1] ?? '');
      return { ok: Boolean(session), command, payload: session ?? { error: 'not found' } };
    }
    case 'delivery': {
      const proof = engine.getProof(args[1] ?? '');
      return { ok: Boolean(proof), command, payload: proof ?? { error: 'not found' } };
    }
    case 'settlement': {
      const settlement = engine.getSettlement(args[1] ?? '') ?? engine.settlementForOrder(args[1] ?? '');
      return { ok: Boolean(settlement), command, payload: settlement ?? { error: 'not found' } };
    }
    case 'revoke': {
      const [machineId, controller, ...reasonParts] = args.slice(1);
      if (!machineId || !controller) {
        return { ok: false, command, payload: { error: 'usage: machine revoke <id> <controller> <reason>' } };
      }
      const result = engine.revoke(machineId, controller, reasonParts.join(' ') || 'controller_revocation');
      return { ok: !isRejection(result), command, payload: result };
    }
    default:
      return { ok: false, command, payload: { error: 'unknown machine command' } };
  }
}

export function grantCliCapabilities(
  engine: MachineEconomyEngine,
  machineId: string,
  controller: string,
  capabilities: readonly MachineCapability[],
): CliResult {
  const result = engine.grantCapabilities({ machineId, controllerActor: controller, capabilities });
  return { ok: !isRejection(result), command: 'capabilities', payload: result };
}

export function writeSnapshot(engine: MachineEconomyEngine, path: string): void {
  writeFileSync(path, JSON.stringify(engine.snapshot(), (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}

export type { MachineCapability, ServiceCategory };
