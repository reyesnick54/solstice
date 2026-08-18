/**
 * sunrey-mainnet CLI and sunrey-genesis candidate commands.
 *
 * Commands work even when external evidence remains incomplete.
 */

import { generateActivationPlan } from './activation-plan.ts';
import { defaultActivationMatrix } from './capabilities.ts';
import { defaultDimensionCatalog } from './dimensions.ts';
import { buildGenesisCandidate } from './genesis-candidate.ts';
import { assembleReadinessRegistry } from './registry.ts';
import { runMainnetCandidateRehearsal } from './rehearsal.ts';
import { buildReadinessReport } from './report.ts';
import { signReadinessBundle } from './bundle.ts';
import { sevenProductionCandidateValidators, validatorCandidateManifest } from './validators.ts';
import {
  custodyReadiness,
  exchangeReadiness,
  interopReadiness,
  moonreyPolicyReadiness,
  oracleReadiness,
  privacyReadiness,
} from './product-readiness.ts';
import { verifyMainnetCandidate } from './verify.ts';
import { runCandidateV2Command } from './candidate-v2/cli.ts';

export type MainnetCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

export function runMainnetCommand(argv: readonly string[]): MainnetCliResult {
  const [command = 'help', sub = ''] = argv;
  if (command === 'candidate-v2') {
    const result = runCandidateV2Command(argv.slice(1));
    return { ok: result.ok, command: result.command, payload: result.payload };
  }
  const records = defaultDimensionCatalog();
  const capabilities = defaultActivationMatrix();

  if (command === 'readiness') {
    const rehearsal = runMainnetCandidateRehearsal();
    return { ok: true, command: 'readiness', payload: jsonSafe(rehearsal.report) };
  }
  if (command === 'evidence') {
    return {
      ok: true,
      command: 'evidence',
      payload: jsonSafe({
        count: records.length,
        records: records.map((row) => ({
          requirementId: row.requirementId,
          dimension: row.dimension,
          verificationStatus: row.verificationStatus,
          externalEvidence: row.externalEvidence,
          source: row.source,
          notes: row.notes,
        })),
        exchange: exchangeReadiness(),
        custody: custodyReadiness(),
        oracle: oracleReadiness(),
        interop: interopReadiness(),
        privacy: privacyReadiness(),
        moonreyPolicy: moonreyPolicyReadiness(),
      }),
    };
  }
  if (command === 'capabilities') {
    return { ok: true, command: 'capabilities', payload: jsonSafe(capabilities) };
  }
  if (command === 'validator-candidates') {
    return {
      ok: true,
      command: 'validator-candidates',
      payload: jsonSafe(validatorCandidateManifest(sevenProductionCandidateValidators())),
    };
  }
  if (command === 'genesis-candidate' || command === 'candidate') {
    const bundle = buildGenesisCandidate();
    return {
      ok: bundle.verification.ok,
      command: 'genesis-candidate',
      payload: jsonSafe({
        genesisHash: bundle.genesisHash,
        validatorSetHash: bundle.validatorSetHash,
        allocationHash: bundle.allocationHash,
        manifest: bundle.manifest,
        verification: bundle.verification,
      }),
    };
  }
  if (command === 'verify' || (command === 'candidate' && sub === 'verify') || (command === 'genesis-candidate' && sub === 'verify')) {
    const report = verifyMainnetCandidate({});
    return { ok: report.ok, command: 'verify', payload: jsonSafe(report) };
  }
  if (command === 'activation-plan') {
    return { ok: true, command: 'activation-plan', payload: jsonSafe(generateActivationPlan(records)) };
  }
  if (command === 'rehearsal') {
    const rehearsal = runMainnetCandidateRehearsal();
    return { ok: rehearsal.deterministic && !rehearsal.productionServicesActivated, command: 'rehearsal', payload: jsonSafe({
      status: rehearsal.status,
      genesisHash: rehearsal.genesisHash,
      validatorCount: rehearsal.validatorCount,
      deterministic: rehearsal.deterministic,
      evidenceIncomplete: rehearsal.evidenceIncomplete,
      productionServicesActivated: rehearsal.productionServicesActivated,
    }) };
  }
  if (command === 'bundle') {
    const registry = assembleReadinessRegistry();
    const report = buildReadinessReport({
      records: registry.records,
      authorizations: registry.authorizations,
      capabilities: registry.capabilities,
      candidateGenesisHash: registry.genesisHash,
    });
    return { ok: true, command: 'bundle', payload: jsonSafe(signReadinessBundle(registry.records, report)) };
  }
  return {
    ok: true,
    command: 'help',
    payload: {
      usage:
        'sunrey-mainnet <readiness|evidence|capabilities|validator-candidates|genesis-candidate|verify|activation-plan|candidate-v2>',
      also: 'sunrey-genesis candidate | sunrey-genesis candidate verify',
      launchesProduction: false,
    },
  };
}
