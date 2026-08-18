/**
 * sunrey-mainnet candidate-v2 commands.
 */

import { compareProductionCandidates } from './compare.ts';
import { createProductionNetworkCandidateV2 } from './assemble.ts';
import { verifyProductionNetworkCandidateV2 } from './verify.ts';

export type CandidateV2CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

export function runCandidateV2Command(argv: readonly string[], root = process.cwd()): CandidateV2CliResult {
  const [command = 'help'] = argv;
  if (command === 'create' || command === 'show') {
    const candidate = createProductionNetworkCandidateV2(root);
    return {
      ok: true,
      command: `candidate-v2 ${command}`,
      payload: jsonSafe({
        candidateId: candidate.candidateId,
        rootHash: candidate.candidateRootHash,
        networkId: candidate.configuration.networkId,
        chainId: candidate.configuration.chainId,
        status: candidate.status,
        mainnetEnabled: candidate.mainnetEnabled,
        productionAuthorized: candidate.productionAuthorized,
        economicRc: candidate.economic.economicRcId,
        protocol: candidate.protocol.combinedHash,
        economic: candidate.economic.combinedHash,
        security: candidate.security.combinedHash,
        topology: candidate.topology.combinedHash,
        services: candidate.services.combinedHash,
        sourceCommit: candidate.manifest.sourceCommit,
      }),
    };
  }
  if (command === 'verify') {
    const report = verifyProductionNetworkCandidateV2(undefined, root);
    return { ok: report.ok, command: 'candidate-v2 verify', payload: jsonSafe(report) };
  }
  if (command === 'compare') {
    return { ok: true, command: 'candidate-v2 compare', payload: jsonSafe(compareProductionCandidates(undefined, root)) };
  }
  if (command === 'topology') {
    const candidate = createProductionNetworkCandidateV2(root);
    return { ok: true, command: 'candidate-v2 topology', payload: jsonSafe(candidate.topology) };
  }
  if (command === 'services') {
    const candidate = createProductionNetworkCandidateV2(root);
    return { ok: true, command: 'candidate-v2 services', payload: jsonSafe(candidate.services) };
  }
  if (command === 'evidence') {
    const candidate = createProductionNetworkCandidateV2(root);
    return { ok: true, command: 'candidate-v2 evidence', payload: jsonSafe(candidate.evidence) };
  }
  return {
    ok: true,
    command: 'candidate-v2 help',
    payload: {
      usage:
        'sunrey-mainnet candidate-v2 <create|show|verify|compare|topology|services|evidence>',
      launchesProduction: false,
      productionAuthorized: false,
    },
  };
}
