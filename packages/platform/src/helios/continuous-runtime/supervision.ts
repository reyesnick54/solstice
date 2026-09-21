import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import type { InMemoryHeliosRuntimeStore } from './store.ts';
import type { HeliosSupervisionMode, HeliosSupervisionScope } from './taxonomy.ts';
import type { MandateRuntimeRegistration, SupervisionControl } from './types.ts';

export type SupervisionDecision = {
  readonly blocked: boolean;
  readonly exitOnly: boolean;
  readonly draining: boolean;
  readonly shutdown: boolean;
  readonly reason: string | null;
  readonly mode: HeliosSupervisionMode;
};

export class HeliosRuntimeSupervision {
  private readonly clock: Clock;
  private readonly store: InMemoryHeliosRuntimeStore;

  constructor(input: { readonly clock: Clock; readonly store: InMemoryHeliosRuntimeStore }) {
    this.clock = input.clock;
    this.store = input.store;
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  pause(scope: HeliosSupervisionScope, scopeKey: string, reason?: string): SupervisionControl {
    return this.setMode(scope, scopeKey, 'PAUSED', reason ?? null);
  }

  resume(scope: HeliosSupervisionScope, scopeKey: string): SupervisionControl {
    return this.setMode(scope, scopeKey, 'NORMAL', null);
  }

  exitOnly(scope: HeliosSupervisionScope, scopeKey: string, reason?: string): SupervisionControl {
    return this.setMode(scope, scopeKey, 'EXIT_ONLY', reason ?? 'exit-only mode');
  }

  drain(scope: HeliosSupervisionScope, scopeKey: string, reason?: string): SupervisionControl {
    return this.setMode(scope, scopeKey, 'DRAINING', reason ?? 'draining work');
  }

  globalPause(reason?: string): SupervisionControl {
    return this.pause('GLOBAL', '*', reason ?? 'global helios pause');
  }

  globalResume(): SupervisionControl {
    return this.resume('GLOBAL', '*');
  }

  requestShutdown(): void {
    this.store.requestShutdown();
    this.setMode('GLOBAL', '*', 'SHUTDOWN', 'graceful shutdown requested');
  }

  evaluate(registration: MandateRuntimeRegistration): SupervisionDecision {
    const checks = [
      this.store.getSupervision('GLOBAL', '*'),
      this.store.getSupervision('CUSTOMER', registration.customerId),
      this.store.getSupervision('STRATEGY', registration.subjectId),
      ...registration.config.strategyIds.map((id) => this.store.getSupervision('STRATEGY', id)),
      ...registration.config.instrumentIds.map((id) => this.store.getSupervision('INSTRUMENT', id)),
      ...registration.config.assetClasses.map((ac) => this.store.getSupervision('ASSET_CLASS', ac)),
      ...registration.config.providerIds.map((id) => this.store.getSupervision('PROVIDER', id)),
    ].filter((row): row is SupervisionControl => row !== undefined);

    if (this.store.isShutdownRequested()) {
      return Object.freeze({
        blocked: true,
        exitOnly: true,
        draining: true,
        shutdown: true,
        reason: 'shutdown requested',
        mode: 'SHUTDOWN',
      });
    }

    for (const control of checks) {
      if (control.mode === 'SHUTDOWN') {
        return Object.freeze({
          blocked: true,
          exitOnly: true,
          draining: true,
          shutdown: true,
          reason: control.reason,
          mode: 'SHUTDOWN',
        });
      }
      if (control.mode === 'PAUSED') {
        return Object.freeze({
          blocked: true,
          exitOnly: false,
          draining: false,
          shutdown: false,
          reason: control.reason,
          mode: 'PAUSED',
        });
      }
      if (control.mode === 'EXIT_ONLY') {
        return Object.freeze({
          blocked: false,
          exitOnly: true,
          draining: false,
          shutdown: false,
          reason: control.reason,
          mode: 'EXIT_ONLY',
        });
      }
      if (control.mode === 'DRAINING') {
        return Object.freeze({
          blocked: true,
          exitOnly: true,
          draining: true,
          shutdown: false,
          reason: control.reason,
          mode: 'DRAINING',
        });
      }
    }

    return Object.freeze({
      blocked: false,
      exitOnly: false,
      draining: false,
      shutdown: false,
      reason: null,
      mode: 'NORMAL',
    });
  }

  private setMode(
    scope: HeliosSupervisionScope,
    scopeKey: string,
    mode: HeliosSupervisionMode,
    reason: string | null,
  ): SupervisionControl {
    const control = Object.freeze({
      scope,
      scopeKey,
      mode,
      updatedAt: this.now(),
      reason,
    });
    this.store.putSupervision(control);
    return control;
  }
}
