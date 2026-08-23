/**
 * Internal operations HTTP lives with the Kernel case owner so the
 * Platform API does not import Kernel. Mount `/internal/v1` from
 * `packages/kernel/src/operations/http.ts`. This file only records the
 * consumer-BFF isolation contract.
 */
export const INTERNAL_OPERATIONS_BASE_PATH = '/internal/v1' as const;
export const INTERNAL_OPERATIONS_NOT_CONSUMER_BFF = true;
export const INTERNAL_OPERATIONS_NOT_LOVABLE = true;
