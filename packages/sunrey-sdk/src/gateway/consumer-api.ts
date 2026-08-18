import { apiError, type ApiErrorEnvelope } from '../errors.ts';

export class ConsumerGatewayApi {
  requireAuth(header: string | undefined, requestId: string): ApiErrorEnvelope | null {
    if (!header) {
      return apiError({
        error_code: 'AUTH_REQUIRED',
        category: 'AUTHORIZATION',
        message: 'consumer account state requires authenticated authorization',
        retryable: false,
        request_id: requestId,
      });
    }
    return null;
  }

  market(): Readonly<Record<string, string | boolean | null>> {
    return Object.freeze({
      base_asset: 'SUNREY_COIN',
      quote_asset: 'MOONREY_COIN',
      fixed_exchange_rate: false,
      quote_kind: 'INDICATIVE',
      guaranteed_execution: false,
      production_activated: false,
      portfolio_exposed: false,
    });
  }

  portfolio(authenticated: boolean, requestId: string): Readonly<Record<string, string | boolean>> | ApiErrorEnvelope {
    if (!authenticated) {
      return apiError({
        error_code: 'AUTH_REQUIRED',
        category: 'AUTHORIZATION',
        message: 'portfolio is private',
        retryable: false,
        request_id: requestId,
      });
    }
    return Object.freeze({
      production_label: 'SIMULATION',
      created_independent_store: false,
      redemption_value_guaranteed: false,
    });
  }
}
