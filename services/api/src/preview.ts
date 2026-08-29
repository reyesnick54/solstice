import {
  createNativeEconomySurface,
  createSandboxWorld,
  startConsumerBff,
  type ConsumerBffRuntime,
} from './consumer/index.ts';
import type { RunningConsumerBff } from './consumer/http.ts';
import { PreviewGrowSurface } from './consumer/preview-grow.ts';

export type SunReyPreviewOptions = {
  readonly host?: string;
  readonly port?: number;
  readonly allowedOrigins?: readonly string[];
  readonly allowLocalOrigins?: boolean;
  readonly allowSandboxPersonas?: boolean;
  readonly allowPreviewAuth?: boolean;
  readonly previewAuthEmail?: string;
  readonly previewAuthPassword?: string;
  readonly providerDown?: boolean;
};

/**
 * Compose the existing canonical Consumer BFF surfaces into one deployable
 * simulation runtime for Lovable/mobile/web integration.
 *
 * This is preview glue only. It does not create a second ledger, Kernel,
 * Exchange, Agent runtime, or compliance plane, and it never enables live
 * financial connectivity.
 */
export function createSunReyPreviewRuntime(
  options: Pick<SunReyPreviewOptions, 'providerDown'> = {},
): ConsumerBffRuntime {
  const world = createSandboxWorld({ providerDown: options.providerDown === true });
  const previewGrow = new PreviewGrowSurface(world.grow, world.bff, world.growOpportunity);
  return Object.freeze({
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    agent: world.agent,
    agentRuntime: world.agentRuntime,
    // PreviewGrowSurface is an HTTP compatibility adapter around the canonical
    // ProductGrowthService. The handler recognizes the lifecycle shape by its
    // home() method; no second growth engine or execution authority is created.
    grow: previewGrow as unknown as NonNullable<ConsumerBffRuntime['grow']>,
    previewDiagnostics: world.previewDiagnostics,
    conversation: world.conversation,
    wallets: world.wallets,
    hin: world.hin,
    hinContributions: world.hinContributions,
    nativeEconomy: createNativeEconomySurface(),
    productiveEconomy: world.productiveEconomy,
    exchange: world.exchange,
    dataRights: world.dataRights,
    vault: world.vault,
    access: world.access,
  });
}

export async function startSunReyPreview(
  options: SunReyPreviewOptions = {},
): Promise<RunningConsumerBff> {
  return startConsumerBff({
    runtime: createSunReyPreviewRuntime({ providerDown: options.providerDown === true }),
    ...(options.host ? { host: options.host } : {}),
    ...(options.port !== undefined ? { port: options.port } : {}),
    allowedOrigins: options.allowedOrigins ?? [],
    allowLocalOrigins: options.allowLocalOrigins !== false,
    allowSandboxPersonas: options.allowSandboxPersonas === true,
    allowPreviewAuth: options.allowPreviewAuth === true,
    previewAuth: {
      ...(options.previewAuthEmail ? { email: options.previewAuthEmail } : {}),
      ...(options.previewAuthPassword ? { password: options.previewAuthPassword } : {}),
    },
  });
}
