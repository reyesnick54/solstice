/**
 * Provider certification service — registry-integrated certification orchestration.
 */

import { loadCatalogFromYaml, getCatalogEntry, type CatalogIndex } from '../catalog/loader.ts';
import type { ProviderConfiguration, ProviderId } from '../types.ts';
import {
  buildProviderCertification,
  resolveCertificationEnvironment,
  runCertificationProbes,
  runCertificationProbesAsync,
  type CertificationProbeContext,
  type NetworkProbeOutcome,
} from './engine.ts';
import { sanitizeFailureMessage } from './errors.ts';
import { isLiveValidatedState } from './state.ts';
import type {
  ProviderCertification,
  ProviderCertificationEnvironment,
  ProviderCertificationReport,
} from './types.ts';
import { PROVIDER_CERTIFICATION_SCHEMA_VERSION } from './types.ts';

export type ProviderCertificationServiceOptions = {
  readonly catalogIndex?: CatalogIndex;
  readonly catalogPath?: string;
  readonly environment?: ProviderCertificationEnvironment;
  readonly nowUtc?: () => string;
};

export type CertifyProviderOptions = {
  readonly configuration?: ProviderConfiguration | null;
  readonly explicitlyDisabled?: boolean;
  readonly credentialAvailable?: boolean;
  readonly liveProbeEnabled?: boolean;
  readonly networkProbe?: () => Promise<NetworkProbeOutcome>;
  readonly degraded?: boolean;
};

export class ProviderCertificationService {
  readonly #catalog: CatalogIndex;
  readonly #environment: ProviderCertificationEnvironment;
  readonly #nowUtc: () => string;

  constructor(options: ProviderCertificationServiceOptions = {}) {
    this.#catalog = options.catalogIndex ?? loadCatalogFromYaml(options.catalogPath);
    this.#environment = options.environment ?? resolveCertificationEnvironment();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  certifyCatalogEntry(
    providerId: ProviderId,
    options: CertifyProviderOptions = {},
  ): ProviderCertification {
    const probe = runCertificationProbes(this.buildProbeContext(providerId, options));
    return buildProviderCertification({
      providerId,
      probe,
      environment: this.#environment,
      explicitlyDisabled: options.explicitlyDisabled,
      degraded: options.degraded,
      nowUtc: this.#nowUtc,
    });
  }

  async certifyCatalogEntryAsync(
    providerId: ProviderId,
    options: CertifyProviderOptions = {},
  ): Promise<ProviderCertification> {
    const probe = await runCertificationProbesAsync(this.buildProbeContext(providerId, options));
    return buildProviderCertification({
      providerId,
      probe,
      environment: this.#environment,
      explicitlyDisabled: options.explicitlyDisabled,
      degraded: options.degraded,
      nowUtc: this.#nowUtc,
    });
  }

  certifyAllCatalogEntries(options: {
    readonly providerIds?: readonly ProviderId[];
    readonly liveProbeEnabled?: boolean;
    readonly networkProbeByProvider?: Readonly<
      Record<string, () => Promise<NetworkProbeOutcome>>
    >;
  } = {}): ProviderCertificationReport {
    const ids =
      options.providerIds ??
      Object.freeze([...this.#catalog.byId.keys()]);
    const providers = ids.map((providerId) =>
      this.certifyCatalogEntry(providerId, {
        liveProbeEnabled: options.liveProbeEnabled,
        networkProbe: options.networkProbeByProvider?.[providerId],
      }),
    );
    return this.buildReport(providers, options.liveProbeEnabled ? 'live' : 'unit');
  }

  async certifyAllCatalogEntriesAsync(options: {
    readonly providerIds?: readonly ProviderId[];
    readonly liveProbeEnabled?: boolean;
    readonly networkProbeByProvider?: Readonly<
      Record<string, () => Promise<NetworkProbeOutcome>>
    >;
    readonly explicitlyEnabledProviderIds?: ReadonlySet<string>;
  } = {}): Promise<ProviderCertificationReport> {
    const ids =
      options.providerIds ??
      Object.freeze([...this.#catalog.byId.keys()]);
    const providers: ProviderCertification[] = [];
    for (const providerId of ids) {
      if (
        options.liveProbeEnabled &&
        options.explicitlyEnabledProviderIds &&
        !options.explicitlyEnabledProviderIds.has(providerId)
      ) {
        providers.push(
          this.skippedCertification(providerId, 'not explicitly enabled for live certification'),
        );
        continue;
      }
      providers.push(
        await this.certifyCatalogEntryAsync(providerId, {
          liveProbeEnabled: options.liveProbeEnabled,
          networkProbe: options.networkProbeByProvider?.[providerId],
        }),
      );
    }
    return this.buildReport(providers, options.liveProbeEnabled ? 'live' : 'unit');
  }

  listLiveValidated(): readonly ProviderCertification[] {
    return Object.freeze(
      this.certifyAllCatalogEntries().providers.filter((entry) =>
        isLiveValidatedState(entry.status),
      ),
    );
  }

  listCatalogProviderIds(): readonly ProviderId[] {
    return Object.freeze([...this.#catalog.byId.keys()]);
  }

  catalogHas(providerId: ProviderId): boolean {
    return getCatalogEntry(this.#catalog, providerId) !== undefined;
  }

  sanitizeForExposure(certification: ProviderCertification): ProviderCertification {
    return Object.freeze({
      ...certification,
      failureCode: certification.failureCode,
      evidence: Object.freeze(
        certification.evidence.map((item) =>
          Object.freeze({
            ...item,
            message: sanitizeFailureMessage(item.message),
          }),
        ),
      ),
    });
  }

  private buildProbeContext(
    providerId: ProviderId,
    options: CertifyProviderOptions,
  ): CertificationProbeContext {
    return {
      providerId,
      catalogEntry: getCatalogEntry(this.#catalog, providerId) ?? null,
      configuration: options.configuration ?? null,
      explicitlyDisabled: options.explicitlyDisabled ?? false,
      credentialAvailable: options.credentialAvailable ?? false,
      environment: this.#environment,
      nowUtc: this.#nowUtc,
      liveProbeEnabled: options.liveProbeEnabled,
      ...(options.networkProbe ? { networkProbe: options.networkProbe } : {}),
    };
  }

  private skippedCertification(providerId: string, reason: string): ProviderCertification {
    return buildProviderCertification({
      providerId,
      probe: runCertificationProbes({
        providerId,
        catalogEntry: getCatalogEntry(this.#catalog, providerId) ?? null,
        configuration: null,
        explicitlyDisabled: false,
        credentialAvailable: false,
        environment: this.#environment,
        nowUtc: this.#nowUtc,
        liveProbeEnabled: false,
      }),
      environment: this.#environment,
      nowUtc: this.#nowUtc,
    });
  }

  private buildReport(
    providers: readonly ProviderCertification[],
    mode: 'unit' | 'live',
  ): ProviderCertificationReport {
    let pass = 0;
    let fail = 0;
    let skipped = 0;
    for (const entry of providers) {
      if (entry.evidence.some((e) => e.outcome === 'SKIPPED' && e.probe === 'network')) {
        skipped += 1;
      } else if (entry.failureCode) {
        fail += 1;
      } else if (entry.status === 'SIMULATED' || isLiveValidatedState(entry.status)) {
        pass += 1;
      } else if (entry.status === 'CATALOGED' || entry.status === 'CONFIGURED') {
        pass += 1;
      } else {
        fail += 1;
      }
    }
    return Object.freeze({
      schemaVersion: PROVIDER_CERTIFICATION_SCHEMA_VERSION,
      generatedAt: this.#nowUtc(),
      environment: this.#environment,
      mode,
      summary: Object.freeze({ total: providers.length, pass, fail, skipped }),
      providers: Object.freeze(providers.map((p) => this.sanitizeForExposure(p))),
    });
  }
}

export function createProviderCertificationService(
  options?: ProviderCertificationServiceOptions,
): ProviderCertificationService {
  return new ProviderCertificationService(options);
}
