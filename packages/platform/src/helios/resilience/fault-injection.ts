/**
 * HELIOS H31 — sandbox-gated fault injection for qualification only.
 * Requires simulation environment and explicit opt-in flag.
 */

import { ENVIRONMENT } from '../../../../config/src/flags.ts';

export const HELIOS_FAULT_INJECTION_ENV = 'HELIOS_FAULT_INJECTION' as const;

export type FaultKind =
  | 'TIMEOUT'
  | 'EXCEPTION'
  | 'DELAYED_EVENT'
  | 'DUPLICATE_EVENT'
  | 'DROPPED_EVENT'
  | 'RESPONSE_CORRUPTION'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'MALFORMED_OUTPUT'
  | 'PROCESS_TERMINATION';

export type InjectedFault = {
  readonly faultId: string;
  readonly kind: FaultKind;
  readonly target: string;
  readonly detail: string;
  readonly delayMs?: number;
};

export type FaultInjectionGate = {
  readonly allowed: boolean;
  readonly reason: string | null;
};

export function assessFaultInjectionGate(
  env: NodeJS.ProcessEnv = process.env,
): FaultInjectionGate {
  if (ENVIRONMENT !== 'simulation') {
    return Object.freeze({ allowed: false, reason: 'ENVIRONMENT is not simulation' });
  }
  if (env[HELIOS_FAULT_INJECTION_ENV] !== '1') {
    return Object.freeze({ allowed: false, reason: `${HELIOS_FAULT_INJECTION_ENV} is not enabled` });
  }
  return Object.freeze({ allowed: true, reason: null });
}

export function assertFaultInjectionAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const gate = assessFaultInjectionGate(env);
  if (!gate.allowed) {
    throw new Error(`HELIOS fault injection blocked: ${gate.reason ?? 'unknown'}`);
  }
}

export function createFault(
  faultId: string,
  kind: FaultKind,
  target: string,
  detail: string,
  delayMs?: number,
): InjectedFault {
  return Object.freeze({
    faultId,
    kind,
    target,
    detail,
    ...(delayMs !== undefined ? { delayMs } : {}),
  });
}

export type FaultInjectorState = {
  readonly faults: ReadonlyMap<string, InjectedFault>;
  readonly fired: ReadonlySet<string>;
};

export function createFaultInjector(): {
  readonly state: FaultInjectorState;
  arm(fault: InjectedFault): void;
  disarm(faultId: string): void;
  shouldFire(faultId: string): InjectedFault | null;
  markFired(faultId: string): void;
  clear(): void;
} {
  const faults = new Map<string, InjectedFault>();
  const fired = new Set<string>();

  return Object.freeze({
    get state(): FaultInjectorState {
      return Object.freeze({ faults, fired });
    },
    arm(fault: InjectedFault) {
      assertFaultInjectionAllowed();
      faults.set(fault.faultId, fault);
    },
    disarm(faultId: string) {
      faults.delete(faultId);
    },
    shouldFire(faultId: string): InjectedFault | null {
      if (!assessFaultInjectionGate().allowed) {
        return null;
      }
      if (fired.has(faultId)) {
        return null;
      }
      return faults.get(faultId) ?? null;
    },
    markFired(faultId: string) {
      fired.add(faultId);
    },
    clear() {
      faults.clear();
      fired.clear();
    },
  });
}

/** Redact common secret patterns from error payloads and logs. */
const SECRET_PATTERNS: readonly RegExp[] = Object.freeze([
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /api[_-]?key["'\s:=]+["']?[A-Za-z0-9\-._]{16,}/gi,
  /password["'\s:=]+["']?[^\s"']{8,}/gi,
  /hmac[_-]?secret["'\s:=]+["']?[A-Za-z0-9+/=]{16,}/gi,
]);

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function payloadContainsSecrets(text: string): boolean {
  const redacted = redactSecrets(text);
  return redacted !== text;
}
