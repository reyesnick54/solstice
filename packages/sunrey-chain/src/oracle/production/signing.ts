import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { HsmKmsProvider } from '../../../../security/src/hsm-kms.ts';
import type { PublicKeyDescriptor } from '../../../../security/src/index.ts';
import type { PrivateKeyMaterial } from '../../../../security/src/redaction.ts';
import {
  defaultOracleCrypto,
  deriveOracleKey,
  signObservation,
  type OracleCryptoPorts,
} from '../crypto.ts';
import type { OracleObservation } from '../types.ts';
import type { OracleSignerKind, ProductionOracleRejection } from './types.ts';

export type OracleSigner = {
  readonly kind: OracleSignerKind;
  readonly realHsmEvidenceExternal: true;
  sign(
    unsigned: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
    requireHybrid: boolean,
  ): Result<OracleObservation, ProductionOracleRejection>;
  publicKey(): PublicKeyDescriptor;
};

export class SoftwareDevelopmentSigner implements OracleSigner {
  readonly kind = 'SOFTWARE_DEVELOPMENT' as const;
  readonly realHsmEvidenceExternal = true as const;

  private readonly ports: OracleCryptoPorts;
  private readonly privateKey: PrivateKeyMaterial;
  private readonly key: PublicKeyDescriptor;

  constructor(ports: OracleCryptoPorts, privateKey: PrivateKeyMaterial, key: PublicKeyDescriptor) {
    this.ports = ports;
    this.privateKey = privateKey;
    this.key = key;
  }

  static fromLabel(label: string, suiteId: string, ports: OracleCryptoPorts = defaultOracleCrypto()): Result<SoftwareDevelopmentSigner, ProductionOracleRejection> {
    const derived = deriveOracleKey(ports, suiteId, label);
    if (!derived.ok) {
      return err({ code: 'SIGNING_FAILED', detail: derived.error.detail });
    }
    return ok(new SoftwareDevelopmentSigner(ports, derived.value.privateKey, derived.value.publicKey));
  }

  sign(
    unsigned: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
    requireHybrid: boolean,
  ): Result<OracleObservation, ProductionOracleRejection> {
    const signed = signObservation(this.ports, unsigned, this.privateKey, this.key, requireHybrid);
    if (!signed.ok) {
      return err({ code: 'SIGNING_FAILED', detail: signed.error.detail });
    }
    return ok(signed.value);
  }

  publicKey(): PublicKeyDescriptor {
    return this.key;
  }
}

export class KmsOracleSigner implements OracleSigner {
  readonly kind = 'KMS' as const;
  readonly realHsmEvidenceExternal = true as const;

  private readonly provider: HsmKmsProvider;
  private readonly software: SoftwareDevelopmentSigner;

  constructor(provider: HsmKmsProvider, software: SoftwareDevelopmentSigner) {
    if (provider.kind !== 'KMS') {
      throw new TypeError('KmsOracleSigner requires a KMS-class provider');
    }
    this.provider = provider;
    this.software = software;
  }

  sign(
    unsigned: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
    requireHybrid: boolean,
  ): Result<OracleObservation, ProductionOracleRejection> {
    const capabilities = this.provider.capabilities();
    if (requireHybrid && !capabilities.hybrid) {
      return err({
        code: 'HSM_PQ_UNSUPPORTED',
        detail: 'KMS hybrid/PQ capability is unavailable; unsupported production HSM PQ is not required',
      });
    }
    return this.software.sign(unsigned, requireHybrid);
  }

  publicKey(): PublicKeyDescriptor {
    return this.software.publicKey();
  }
}

export class HsmOracleSigner implements OracleSigner {
  readonly kind = 'HSM' as const;
  readonly realHsmEvidenceExternal = true as const;

  private readonly provider: HsmKmsProvider;
  private readonly software: SoftwareDevelopmentSigner;

  constructor(provider: HsmKmsProvider, software: SoftwareDevelopmentSigner) {
    if (provider.kind !== 'HSM') {
      throw new TypeError('HsmOracleSigner requires an HSM-class provider');
    }
    this.provider = provider;
    this.software = software;
  }

  sign(
    unsigned: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
    requireHybrid: boolean,
  ): Result<OracleObservation, ProductionOracleRejection> {
    const capabilities = this.provider.capabilities();
    if (capabilities.externalHsmPqSupported !== false) {
      return err({ code: 'HSM_PQ_UNSUPPORTED', detail: 'real HSM PQ evidence remains external' });
    }
    if (requireHybrid && !capabilities.hybrid && !capabilities.postQuantum) {
      return err({
        code: 'HSM_PQ_UNSUPPORTED',
        detail: 'HSM signer interface refuses unsupported production HSM PQ algorithms',
      });
    }
    if (!this.provider.simulation) {
      return err({
        code: 'HSM_PQ_UNSUPPORTED',
        detail: 'real HSM evidence remains external; simulation HSM only',
      });
    }
    return this.software.sign(unsigned, requireHybrid);
  }

  publicKey(): PublicKeyDescriptor {
    return this.software.publicKey();
  }
}

export function canonicalOracleSigningPurpose(): 'ORACLE_SIGNING' {
  return 'ORACLE_SIGNING';
}
