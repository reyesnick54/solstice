/**
 * Wave 3 — explicit PEVE and GPUV methodology references.
 *
 * Does not modify formulas. Claims and valuations bind to methodology id + version.
 */

import { createHash } from 'node:crypto';

import type { MethodologyDefinitionRef } from './types.ts';
import type { PolicyEconomy } from './taxonomy.ts';

export const METHODOLOGY_SCHEMA_VERSION = 1 as const;

/** PEVE formula references — packages/platform/src/value/formula.ts */
export const PEVE_METHODOLOGY_IDS = {
  FORMULA_V1: 'peve-formula-v1',
  FORMULA_V2: 'peve-formula-v2',
  MODEL_V1: 'peve-model-v1',
  MODEL_V2: 'peve-model-v2',
} as const;

/** GPUV methodology references — productive/policy-governance/value-function */
export const GPUV_METHODOLOGY_IDS = {
  SIMULATION_V1: 'moonrey.productive-value-function.simulation.v1',
} as const;

export const HUMAN_VALUATION_METHODOLOGY_IDS = {
  SIMULATION_V1: 'sunrey.human-contribution.valuation.simulation.v1',
} as const;

export function methodologyContentHash(input: {
  readonly methodologyId: string;
  readonly version: string;
  readonly economy: PolicyEconomy;
  readonly documentRef: string;
}): string {
  return createHash('sha256')
    .update(
      stable({
        domain: 'SUNREY_METHODOLOGY_DEFINITION_V1',
        methodologyId: input.methodologyId,
        version: input.version,
        economy: input.economy,
        documentRef: input.documentRef,
      }),
    )
    .digest('hex');
}

export function peveMethodologyRef(
  formulaVersion: keyof typeof PEVE_METHODOLOGY_IDS,
  documentRef: string,
): MethodologyDefinitionRef {
  const methodologyId = PEVE_METHODOLOGY_IDS[formulaVersion];
  const version = formulaVersion.endsWith('V2') ? '2' : '1';
  return Object.freeze({
    methodologyId,
    version,
    economy: 'SUNREY',
    documentRef,
    contentHash: methodologyContentHash({
      methodologyId,
      version,
      economy: 'SUNREY',
      documentRef,
    }),
    schemaVersion: METHODOLOGY_SCHEMA_VERSION,
  });
}

export function gpuvMethodologyRef(
  policyVersion: number,
  documentRef: string,
): MethodologyDefinitionRef {
  const methodologyId = GPUV_METHODOLOGY_IDS.SIMULATION_V1;
  const version = String(policyVersion);
  return Object.freeze({
    methodologyId,
    version,
    economy: 'MOONREY',
    documentRef,
    contentHash: methodologyContentHash({
      methodologyId,
      version,
      economy: 'MOONREY',
      documentRef,
    }),
    schemaVersion: METHODOLOGY_SCHEMA_VERSION,
  });
}

export function humanValuationMethodologyRef(
  policyVersion: string,
  documentRef: string,
): MethodologyDefinitionRef {
  const methodologyId = HUMAN_VALUATION_METHODOLOGY_IDS.SIMULATION_V1;
  return Object.freeze({
    methodologyId,
    version: policyVersion,
    economy: 'SUNREY',
    documentRef,
    contentHash: methodologyContentHash({
      methodologyId,
      version: policyVersion,
      economy: 'SUNREY',
      documentRef,
    }),
    schemaVersion: METHODOLOGY_SCHEMA_VERSION,
  });
}

export function methodologyEconomyMatches(
  methodology: MethodologyDefinitionRef,
  economy: PolicyEconomy,
): boolean {
  return methodology.economy === economy;
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
