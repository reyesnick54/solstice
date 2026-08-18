import { createHash, randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { asExchangeAccountId, type ExchangeAccountId, type OrderId } from '../ids.ts';
import type { DigitalOrder } from '../types.ts';
import type { CanonicalMarketFamily, GatewayProtocol, TradingEnvironment } from './taxonomy.ts';
import type {
  GatewayRecovery,
  InstitutionalOrderAck,
  InstitutionalOrderRequest,
  TradingCredential,
  TradingSession,
} from './types.ts';

export type FixStyleMessage = {
  readonly beginString: 'SUNREY.FIX.SIM';
  readonly msgType: 'A' | '5' | 'D' | 'F' | 'G' | 'H' | '2' | 'q';
  readonly msgSeqNum: bigint;
  readonly senderCompId: string;
  readonly targetCompId: 'SUNREY.EXCHANGE';
  readonly clOrdId?: string;
  readonly origClOrdId?: string;
  readonly symbol?: string;
  readonly side?: '1' | '2';
  readonly ordType?: '2' | 'P' | '3' | '4' | 'P1';
  readonly orderQty?: string;
  readonly price?: string;
  readonly certifiedFix: false;
};

export type WebsocketFrame = {
  readonly type: 'logon' | 'logout' | 'new' | 'cancel' | 'cancel_replace' | 'status' | 'resend' | 'mass_cancel' | 'quote';
  readonly seq: bigint;
  readonly payload: Readonly<Record<string, string>>;
};

function credentialHash(input: {
  readonly participantId: string;
  readonly accountId: string;
  readonly sessionId: string;
}): string {
  return `xcred_${createHash('sha256').update(`${input.participantId}:${input.accountId}:${input.sessionId}`).digest('hex').slice(0, 24)}`;
}

export function issueTradingCredential(input: {
  readonly participantId: string;
  readonly accountId: string;
  readonly marketPermissions: readonly CanonicalMarketFamily[];
  readonly environment: TradingEnvironment;
  readonly sessionId?: string;
  readonly protocol?: GatewayProtocol;
  readonly cancelOnDisconnect?: boolean;
  readonly marketMaker?: boolean;
}): TradingCredential {
  const sessionId = input.sessionId ?? `xses_${randomUUID().replace(/-/g, '')}`;
  return Object.freeze({
    credentialId: credentialHash({ participantId: input.participantId, accountId: input.accountId, sessionId }),
    participantId: input.participantId,
    accountId: asExchangeAccountId(input.accountId),
    marketPermissions: Object.freeze([...input.marketPermissions]),
    environment: input.environment,
    sessionId,
    protocol: input.protocol ?? 'NATIVE',
    cancelOnDisconnect: input.cancelOnDisconnect ?? false,
    marketMaker: input.marketMaker ?? false,
    custodyPrivateKeyPresent: false,
  });
}

export function rejectCredentialWithCustodyKey(raw: Record<string, unknown>): {
  readonly accepted: false;
  readonly reason: 'CUSTODY_PRIVATE_KEY_FORBIDDEN';
} | null {
  const keys = ['custodyPrivateKey', 'privateKey', 'signingKey', 'hsmSecret'];
  if (keys.some((key) => key in raw && raw[key] != null && raw[key] !== '')) {
    return { accepted: false, reason: 'CUSTODY_PRIVATE_KEY_FORBIDDEN' };
  }
  return null;
}

export class InstitutionalOrderGateway {
  readonly sessions = new Map<string, TradingSession>();
  readonly credentials = new Map<string, TradingCredential>();
  readonly idempotency = new Map<string, InstitutionalOrderAck>();
  readonly outbound = new Map<string, unknown[]>();
  private readonly onDisconnect: (session: TradingSession) => void;

  constructor(input: { readonly onDisconnect?: (session: TradingSession) => void } = {}) {
    this.onDisconnect = input.onDisconnect ?? (() => undefined);
  }

  register(credential: TradingCredential): TradingCredential {
    if (credential.custodyPrivateKeyPresent) {
      throw Object.assign(new Error('CUSTODY_PRIVATE_KEY_FORBIDDEN'), { code: 'CUSTODY_PRIVATE_KEY_FORBIDDEN' });
    }
    this.credentials.set(credential.credentialId, credential);
    return credential;
  }

  logon(credentialId: string, now: UtcInstant): TradingSession {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw Object.assign(new Error('UNKNOWN_CREDENTIAL'), { code: 'UNKNOWN_CREDENTIAL' });
    }
    const session: TradingSession = Object.freeze({
      sessionId: credential.sessionId,
      credentialId: credential.credentialId,
      participantId: credential.participantId,
      accountId: credential.accountId,
      environment: credential.environment,
      protocol: credential.protocol,
      inboundSeq: 0n,
      outboundSeq: 0n,
      authenticated: true,
      cancelOnDisconnect: credential.cancelOnDisconnect,
      lastHeartbeatAt: now,
    });
    this.sessions.set(session.sessionId, session);
    this.outbound.set(session.sessionId, []);
    return session;
  }

  authenticate(sessionId: string): TradingSession {
    const session = this.sessions.get(sessionId);
    if (!session?.authenticated) {
      throw Object.assign(new Error('SESSION_UNAUTHENTICATED'), { code: 'SESSION_UNAUTHENTICATED' });
    }
    return session;
  }

  acceptInbound(sessionId: string, expectedSeq: bigint): TradingSession {
    const session = this.authenticate(sessionId);
    if (expectedSeq !== session.inboundSeq + 1n) {
      throw Object.assign(new Error('SEQUENCE_GAP'), { code: 'SEQUENCE_GAP', lastInbound: session.inboundSeq });
    }
    const next: TradingSession = Object.freeze({ ...session, inboundSeq: expectedSeq });
    this.sessions.set(sessionId, next);
    return next;
  }

  remember(sessionId: string, clOrdId: string, ack: InstitutionalOrderAck): InstitutionalOrderAck {
    this.idempotency.set(`${sessionId}:${clOrdId}`, ack);
    return ack;
  }

  replayIdempotent(sessionId: string, clOrdId: string): InstitutionalOrderAck | null {
    return this.idempotency.get(`${sessionId}:${clOrdId}`) ?? null;
  }

  recover(sessionId: string, openOrders: readonly DigitalOrder[]): GatewayRecovery {
    const session = this.authenticate(sessionId);
    return Object.freeze({
      sessionId,
      lastInboundSeq: session.inboundSeq,
      lastOutboundSeq: session.outboundSeq,
      openOrders,
    });
  }

  logout(sessionId: string): TradingSession {
    const session = this.authenticate(sessionId);
    const closed: TradingSession = Object.freeze({ ...session, authenticated: false });
    this.sessions.set(sessionId, closed);
    if (session.cancelOnDisconnect) {
      this.onDisconnect(session);
    }
    return closed;
  }

  decodeFix(message: FixStyleMessage): { readonly type: string; readonly request?: InstitutionalOrderRequest } {
    const side = message.side === '1' ? 'BUY' : 'SELL';
    const orderType =
      message.ordType === 'P'
        ? 'MARKET_WITH_PROTECTION'
        : message.ordType === '3'
          ? 'IOC'
          : message.ordType === '4'
            ? 'FOK'
            : message.ordType === 'P1'
              ? 'POST_ONLY'
              : 'LIMIT';
    if (message.msgType === 'D' || message.msgType === 'G') {
      return {
        type: message.msgType === 'D' ? 'NEW_ORDER' : 'CANCEL_REPLACE',
        request: {
          clOrdId: message.clOrdId ?? '',
          marketId: (message.symbol ?? '') as InstitutionalOrderRequest['marketId'],
          side,
          orderType,
          quantity: BigInt(message.orderQty ?? '0'),
          priceUnits: message.price ? BigInt(message.price) : null,
          ...(message.origClOrdId ? { origClOrdId: message.origClOrdId } : {}),
        },
      };
    }
    if (message.msgType === 'F') {
      return { type: 'CANCEL', request: {
        clOrdId: message.clOrdId ?? '',
        marketId: (message.symbol ?? '') as InstitutionalOrderRequest['marketId'],
        side,
        orderType: 'LIMIT',
        quantity: 0n,
        priceUnits: null,
        ...(message.origClOrdId ? { origClOrdId: message.origClOrdId } : {}),
      } };
    }
    if (message.msgType === 'H') {
      return { type: 'ORDER_STATUS' };
    }
    if (message.msgType === '2') {
      return { type: 'RESEND_REQUEST' };
    }
    if (message.msgType === 'q') {
      return { type: 'MASS_CANCEL' };
    }
    if (message.msgType === '5') {
      return { type: 'LOGOUT' };
    }
    return { type: 'LOGON' };
  }

  decodeWebsocket(frame: WebsocketFrame): { readonly type: string; readonly request?: InstitutionalOrderRequest } {
    const payload = frame.payload;
    if (frame.type === 'new' || frame.type === 'cancel_replace' || frame.type === 'cancel') {
      return {
        type: frame.type === 'new' ? 'NEW_ORDER' : frame.type === 'cancel' ? 'CANCEL' : 'CANCEL_REPLACE',
        request: {
          clOrdId: payload.clOrdId ?? '',
          marketId: (payload.marketId ?? '') as InstitutionalOrderRequest['marketId'],
          side: payload.side === 'SELL' ? 'SELL' : 'BUY',
          orderType:
            payload.orderType === 'IOC' ||
            payload.orderType === 'FOK' ||
            payload.orderType === 'POST_ONLY' ||
            payload.orderType === 'MARKET_WITH_PROTECTION'
              ? payload.orderType
              : 'LIMIT',
          quantity: BigInt(payload.quantity ?? '0'),
          priceUnits: payload.priceUnits ? BigInt(payload.priceUnits) : null,
          ...(payload.origClOrdId ? { origClOrdId: payload.origClOrdId } : {}),
        },
      };
    }
    return { type: frame.type.toUpperCase() };
  }
}

export function developerApiKeyCannotTradeProduction(apiKeyEnvironment: TradingEnvironment): {
  readonly canTradeProductionFunds: false;
  readonly requiresTradingAuthorityForProduction: true;
} {
  void apiKeyEnvironment;
  return Object.freeze({
    canTradeProductionFunds: false,
    requiresTradingAuthorityForProduction: true,
  });
}

export type { ExchangeAccountId, OrderId };
