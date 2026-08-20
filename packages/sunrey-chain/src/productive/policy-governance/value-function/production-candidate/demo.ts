/**
 * demo:moonrey-production-policy-candidate
 *
 * Demonstrates the governed chain up to fixture GPUV and fixture
 * conversion, then STOPS before production issuance.
 */

import { evaluateProductionEconomicActivation, currentRepositorySnapshot } from '../../../../economics/production-activation/index.ts';
import {
  rehearsalConversionPolicy,
  rehearsalEvidence,
  rehearsalUsage,
  convertProductionCandidateGpuv,
} from '../../value-settlement/production-candidate/index.ts';
import { evaluateProductionCandidateValue } from './receipt.ts';
import { rehearsalEnergySchedule, rehearsalProductiveValuePolicyCandidate, rehearsalValueInput } from './fixtures.ts';

export function runMoonReyProductionPolicyCandidateDemo(): void {
  const contribution = 'c.rehearsal.energy.1';
  const event = 'event.rehearsal.energy.1';
  const attribution = 'attr.rehearsal.energy.1';
  const policy = rehearsalProductiveValuePolicyCandidate();
  const schedule = rehearsalEnergySchedule();
  const valued = evaluateProductionCandidateValue(
    rehearsalValueInput({ fixturePolicy: false, canonicalQuantity: 14_000n }),
    policy,
    schedule,
  );
  const gpuv = valued.ok ? valued.value.gpuvQuantity : null;
  const conversion = rehearsalConversionPolicy();
  const converted =
    gpuv === null
      ? { ok: false as const, code: 'VALUE_UNCONFIGURED', detail: 'no GPUV' }
      : convertProductionCandidateGpuv({
          gpuvQuantity: gpuv,
          policy: conversion,
          evidence: rehearsalEvidence(),
          usage: rehearsalUsage(),
          authorizedBy: 'HUMAN',
        });

  process.stdout.write('MoonRey production-candidate policy (Chunk 146)\n');
  process.stdout.write(`verified productive contribution=${contribution}\n`);
  process.stdout.write(`event=${event}\n`);
  process.stdout.write(`attribution=${attribution}\n`);
  process.stdout.write(`fixture production-candidate PVF=${policy.policyId}\n`);
  process.stdout.write(`fixture GPUV=${gpuv === null ? 'UNCONFIGURED' : String(gpuv)}\n`);
  process.stdout.write(
    `fixture conversion candidate=${converted.ok ? String(converted.value) : converted.code}\n`,
  );
  process.stdout.write('STOP before production issuance\n');
  process.stdout.write('GPUV_EQUALS_MOONREY=false\n');
  process.stdout.write('MOONREY_MARKET_PRICE_FEEDS_PVF=false\n');
  process.stdout.write('LEGACY_V1_PRODUCTION_ELIGIBLE=false\n');
  process.stdout.write('PRODUCTION_GPUV_VALUES_SELECTED=false\n');
  process.stdout.write('PRODUCTION_CONVERSION_SELECTED=false\n');
  process.stdout.write('FIXTURE_AUTHORIZES_PRODUCTION=false\n');
  process.stdout.write('CHUNK_71_REMAINS_MONETARY_AUTHORITY=true\n');
  process.stdout.write('PRODUCTION_ACTIVE=false\n');

  const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const moonrey = firewall.domainDecisions.find((row) => row.domain === 'MOONREY_COIN_ISSUANCE');
  process.stdout.write(`MOONREY_COIN_ISSUANCE=${moonrey?.state ?? 'UNKNOWN'}\n`);
}

runMoonReyProductionPolicyCandidateDemo();
