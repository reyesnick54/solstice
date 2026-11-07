import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { SandboxHeliosProviderPort } from '../../order-lifecycle/sandbox-provider.ts';
import type { ProviderSubmitRequest, ProviderSubmitResult } from '../../order-lifecycle/provider-port.ts';
import type { BrokerCapabilityManifest } from './broker-capability-manifest.ts';
import { isFieldAvailable } from './declared-field.ts';

export type Exec14BrokerStatement = Readonly<{
  readonly statementId: string;
  readonly asOf: UtcInstant;
  readonly cashMinorUnits: string;
  readonly currency: string;
  readonly positions: Readonly<Record<string, string>>;
  readonly simulation: true;
}>;

export type Exec14BrokerConformancePort = Readonly<{
  readonly providerId: string;
  readonly manifest: BrokerCapabilityManifest;
  readonly liveProviderConnected: false;
  readonly productionAuthorized: false;
  authenticate(): { readonly ok: boolean; readonly evidenceRef: string };
  submit(request: ProviderSubmitRequest): ProviderSubmitResult;
  query(externalOperationId: string): ReturnType<SandboxHeliosProviderPort['query']>;
  cancel(providerOrderId: string, externalOperationId: string): ReturnType<SandboxHeliosProviderPort['cancel']>;
  replace(
    providerOrderId: string,
    externalOperationId: string,
    request: ProviderSubmitRequest,
  ): ProviderSubmitResult;
  getStatement(accountId: string, now: UtcInstant): Exec14BrokerStatement;
  syncFills(externalOperationId: string, now: UtcInstant): void;
  restart(): void;
}>;

export function createFixtureExec14BrokerPort(manifest: BrokerCapabilityManifest): Exec14BrokerConformancePort {
  const sandbox = new SandboxHeliosProviderPort();
  sandbox.setScenario('ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL');
  let cashMinor = 1_000_000n;
  const positions: Record<string, bigint> = {};

  const applySimulatedFill = (request: ProviderSubmitRequest): void => {
    const now = asUtcInstant(new Date().toISOString());
    sandbox.advanceScenarioFill(request.externalOperationId, now);
    if (request.side === 'BUY') {
      cashMinor -= BigInt(request.quantityUnits) * 10_000n;
      positions[request.instrumentId] = (positions[request.instrumentId] ?? 0n) + BigInt(request.quantityUnits);
    } else {
      cashMinor += BigInt(request.quantityUnits) * 10_000n;
      positions[request.instrumentId] = (positions[request.instrumentId] ?? 0n) - BigInt(request.quantityUnits);
    }
  };

  return Object.freeze({
    providerId: manifest.providerId,
    manifest,
    liveProviderConnected: false,
    productionAuthorized: false,

    authenticate() {
      return Object.freeze({ ok: true, evidenceRef: `ev_auth_${manifest.providerId}` });
    },

    submit(request) {
      const result = sandbox.submit(request);
      if (result.outcome === 'ACKNOWLEDGED' || result.outcome === 'PENDING') {
        applySimulatedFill(request);
      }
      return result;
    },

    query(externalOperationId) {
      return sandbox.query(externalOperationId);
    },

    cancel(providerOrderId, externalOperationId) {
      return sandbox.cancel(providerOrderId, externalOperationId);
    },

    replace(providerOrderId, externalOperationId, request) {
      const cancelled = sandbox.cancel(providerOrderId, externalOperationId);
      if (cancelled.outcome === 'UNAVAILABLE') {
        return { outcome: 'REJECTED', providerOrderId, evidenceRef: `ev_replace_fail_${externalOperationId}` };
      }
      return sandbox.submit({
        ...request,
        externalOperationId: `${externalOperationId}_replace`,
      });
    },

    syncFills(externalOperationId: string, now: UtcInstant) {
      sandbox.advanceScenarioFill(externalOperationId, now);
    },

    getStatement(accountId: string, now: UtcInstant) {
      const posView: Record<string, string> = {};
      for (const [symbol, qty] of Object.entries(positions)) {
        posView[symbol] = qty.toString();
      }
      return Object.freeze({
        statementId: `stmt_${accountId}_${now.slice(0, 10)}`,
        asOf: now,
        cashMinorUnits: cashMinor.toString(),
        currency: 'USD',
        positions: Object.freeze(posView),
        simulation: true,
      });
    },

    restart() {
      sandbox.setScenario('ACKNOWLEDGE_THEN_FILL');
    },
  });
}

export function sampleBrokerSubmitRequest(overrides: Partial<ProviderSubmitRequest> = {}): ProviderSubmitRequest {
  const base: ProviderSubmitRequest = {
    externalOperationId: 'ext_exec14_001',
    operationId: 'op_exec14_001',
    orderId: 'ord_exec14_001',
    instrumentId: 'AAPL',
    side: 'BUY',
    quantityUnits: '10',
    orderType: 'MARKET',
    limitPriceMinorUnits: null,
    currency: 'USD',
    timeInForce: 'DAY',
  };
  return Object.freeze({ ...base, ...overrides });
}

export function brokerPortSupportsReplace(port: Exec14BrokerConformancePort): boolean {
  return isFieldAvailable(port.manifest.cancelReplace) && port.manifest.cancelReplace.value === true;
}
