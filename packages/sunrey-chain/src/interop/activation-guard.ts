import { assertInteropDevelopmentOnly } from '../../../config/src/activation-gates.ts';

/** Fail closed before any interop mutation when production gates are unsafe. */
export function assertInteropActivationGate(): void {
  assertInteropDevelopmentOnly();
}
