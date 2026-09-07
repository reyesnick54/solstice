import {
  createNativeEconomySurface,
  createSandboxWorld,
  startConsumerBff,
  type ConsumerBffRuntime,
} from './consumer/index.ts';
import type { RunningConsumerBff } from './consumer/http.ts';
import { ExchangeBffSurface } from './consumer/exchange.ts';
import { PreviewGrowSurface } from './consumer/preview-grow.ts';
import { bindDurableFinancialReadModel } from './consumer/durable-consumer-bff.ts';
import type { SimulationRuntime } from '../../accounts/src/runtime.ts';

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
  readonly durableFinancialRuntime?: SimulationRuntime;
};

/**
 * Compose the existing canonical Consumer BFF surfaces into one deployable
 * simulation runtime for Lovable/mobile/web integration.
 *
 * Hosted durable mode may replace account/ledger-derived reads with the
 * PostgreSQL-backed runtime while the remaining preview domains stay isolated
 * until their own durable stores are bound. This never enables live financial
 * connectivity or creates a second ledger.
 */
export function createSunReyPreviewRuntime(
  options: Pick<SunReyPreviewOptions, 'providerDown' | 'durableFinancialRuntime'> = {},
): ConsumerBffRuntime {
  const world = createSandboxWorld({ providerDown: options.providerDown === true });
  const previewGrow = new PreviewGrowSurface(world.grow, world.bff, world.growOpportunity);
  const exchange = new ExchangeBffSurface(() => world.runtime.clock.now());
  const bff = options.durableFinancialRuntime
    ? bindDurableFinancialReadModel(world.bff, options.durableFinancialRuntime)
    : world.bff;
  return Object.freeze({
    bff,
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
    moneyIntegration: world.moneyIntegration,
    hin: world.hin,
    hinContributions: world.hinContributions,
    nativeEconomy: createNativeEconomySurface(),
    productiveEconomy: world.productiveEconomy,
    exchange,
    dataRights: world.dataRights,
    vault: world.vault,
    access: world.access,
    hinAccess: world.hinAccess,
    worldExternalData: world.worldExternalData,
    environmental: world.environmental,
    travel: world.travel,
    agentExternalEvidence: world.agentExternalEvidence,
    providerDown: world.providerDown,
  });
}

export async function startSunReyPreview(
  options: SunReyPreviewOptions = {},
): Promise<RunningConsumerBff> {
  return startConsumerBff({
    runtime: createSunReyPreviewRuntime({
      providerDown: options.providerDown === true,
      ...(options.durableFinancialRuntime ? { durableFinancialRuntime: options.durableFinancialRuntime } : {}),
    }),
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
