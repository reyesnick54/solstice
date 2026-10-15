import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  CorporateActionRevisionRow,
  MissingnessPolicy,
  RevisionPolicy,
  TemporalFeatureDefinition,
  TemporalObservation,
  TickerSymbolRow,
  UniverseMembershipRow,
} from '../temporal-types.ts';
import { selectAsOfLatest, selectAsOfSeries } from './as-of.ts';
import {
  assertCorporateActionKnowable,
  assertFutureConstituentLeak,
  assertObservationKnowable,
  detectRestatementLeak,
  isKnowableAtDecision,
  isUniverseMemberAt,
  type LeakageViolation,
} from './leakage.ts';
import { freezePointInTimeDatasetManifest, type CompilerFailure, type PointInTimeDatasetManifest } from './manifest.ts';
import { crossSectionalRankBps, laggedValueMinor, rollingSumMinor } from './rolling.ts';
import { AAF04_COMPILER_VERSION } from './version.ts';

export type FeatureCompilerContext = {
  readonly observations: readonly TemporalObservation[];
  readonly universeMembership: readonly UniverseMembershipRow[];
  readonly tickerHistory: readonly TickerSymbolRow[];
  readonly corporateActionRevisions: readonly CorporateActionRevisionRow[];
  readonly entityResolutionVersion: string;
  readonly revisionPolicy: RevisionPolicy;
  readonly missingnessPolicy: MissingnessPolicy;
  readonly indexId?: string;
};

export type CompiledFeatureValue = {
  readonly featureId: string;
  readonly valueMinor: bigint | null;
  readonly observationRef: string | null;
};

export type CompiledFeatureVector = {
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTime: UtcInstant;
  readonly universeVersion: string;
  readonly features: readonly CompiledFeatureValue[];
  readonly compilerVersion: typeof AAF04_COMPILER_VERSION;
};

export type CompileFeatureVectorInput = {
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTime: UtcInstant;
  readonly universeVersion: string;
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly context: FeatureCompilerContext;
};

function matchesDefinition(row: TemporalObservation, def: TemporalFeatureDefinition, entityId: string, instrumentId: string): boolean {
  if (row.kind !== def.observationKind) {
    return false;
  }
  if (def.entityId && row.entityId !== def.entityId) {
    return false;
  }
  if (def.instrumentId && row.instrumentId !== def.instrumentId) {
    return false;
  }
  if (row.entityId !== entityId && def.computeKind !== 'CROSS_SECTIONAL_RANK') {
    return false;
  }
  if (row.instrumentId && row.instrumentId !== instrumentId && def.computeKind !== 'CROSS_SECTIONAL_RANK') {
    return false;
  }
  return true;
}

function leakageFailure(violation: LeakageViolation): CompilerFailure {
  return Object.freeze({
    code: 'LEAKAGE_DETECTED',
    message: violation.message,
    leakageCode: violation.code,
  });
}

function guardContext(input: CompileFeatureVectorInput): LeakageViolation | null {
  const restatement = detectRestatementLeak(input.context.observations, input.decisionTime);
  if (restatement) {
    return restatement;
  }
  if (input.context.indexId) {
    for (const row of input.context.universeMembership) {
      if (row.indexId !== input.context.indexId || row.instrumentId !== input.instrumentId) {
        continue;
      }
      const leak = assertFutureConstituentLeak(row, input.decisionTime);
      if (leak) {
        return leak;
      }
    }
  }
  return null;
}

function rejectIfOnlyFutureCandidates(
  scoped: readonly TemporalObservation[],
  decisionTime: UtcInstant,
): LeakageViolation | null {
  const knowable = scoped.filter((row) => isKnowableAtDecision(decisionTime, row.knowableAt));
  if (knowable.length > 0) {
    return null;
  }
  const future = scoped[0];
  if (!future) {
    return null;
  }
  return assertObservationKnowable(future, decisionTime);
}

function compileOneFeature(
  input: CompileFeatureVectorInput,
  def: TemporalFeatureDefinition,
): Result<CompiledFeatureValue, CompilerFailure> {
  const scoped = input.context.observations.filter((row) =>
    matchesDefinition(row, def, input.entityId, input.instrumentId),
  );

  const onlyFuture = rejectIfOnlyFutureCandidates(scoped, input.decisionTime);
  if (onlyFuture) {
    return err(leakageFailure(onlyFuture));
  }

  const series = selectAsOfSeries(scoped, input.decisionTime, input.context.revisionPolicy);

  if (def.computeKind === 'AS_OF_SCALAR') {
    const asOf = selectAsOfLatest(scoped, input.decisionTime, input.context.revisionPolicy);
    if (!asOf.selected) {
      for (const row of scoped) {
        if (isKnowableAtDecision(input.decisionTime, row.knowableAt)) {
          const expired = assertObservationKnowable(row, input.decisionTime);
          if (expired?.code === 'FORWARD_FILL_BEYOND_VALIDITY') {
            return err(leakageFailure(expired));
          }
        }
      }
      if (input.context.missingnessPolicy === 'FAIL_CLOSED') {
        return err({ code: 'MISSING_FEATURE', message: `no knowable observation for feature ${def.featureId}` });
      }
      return ok(Object.freeze({ featureId: def.featureId, valueMinor: null, observationRef: null }));
    }
    const leak = assertObservationKnowable(asOf.selected, input.decisionTime);
    if (leak) {
      return err(leakageFailure(leak));
    }
    return ok(
      Object.freeze({
        featureId: def.featureId,
        valueMinor: asOf.selected.valueMinor,
        observationRef: asOf.selected.observationRef,
      }),
    );
  }

  if (def.computeKind === 'LAGGED') {
    const lag = def.lagPeriods ?? 1;
    const valueMinor = laggedValueMinor(series, lag);
    if (valueMinor === null) {
      if (input.context.missingnessPolicy === 'FAIL_CLOSED') {
        return err({ code: 'MISSING_FEATURE', message: `insufficient lag history for feature ${def.featureId}` });
      }
      return ok(Object.freeze({ featureId: def.featureId, valueMinor: null, observationRef: null }));
    }
    const source = series.at(-1 - lag) ?? null;
    return ok(
      Object.freeze({
        featureId: def.featureId,
        valueMinor,
        observationRef: source?.observationRef ?? null,
      }),
    );
  }

  if (def.computeKind === 'ROLLING_SUM') {
    const window = def.rollingWindow ?? 1;
    const valueMinor = rollingSumMinor(series, window);
    if (valueMinor === null) {
      if (input.context.missingnessPolicy === 'FAIL_CLOSED') {
        return err({
          code: 'MISSING_FEATURE',
          message: `rolling window ${String(window)} not satisfied for feature ${def.featureId}`,
        });
      }
      return ok(Object.freeze({ featureId: def.featureId, valueMinor: null, observationRef: null }));
    }
    const source = series.at(-1) ?? null;
    return ok(
      Object.freeze({
        featureId: def.featureId,
        valueMinor,
        observationRef: source?.observationRef ?? null,
      }),
    );
  }

  if (def.computeKind === 'CROSS_SECTIONAL_RANK') {
    const members = input.context.universeMembership.filter(
      (row) => row.indexId === (input.context.indexId ?? 'DEFAULT'),
    );
    const values: { instrumentId: string; valueMinor: bigint }[] = [];
    for (const member of members) {
      const leak = assertFutureConstituentLeak(member, input.decisionTime);
      if (leak) {
        return err(leakageFailure(leak));
      }
      if (!isUniverseMemberAt(member, input.decisionTime)) {
        continue;
      }
      const memberObs = input.context.observations.filter(
        (row) => row.kind === def.observationKind && row.instrumentId === member.instrumentId,
      );
      const asOf = selectAsOfLatest(memberObs, input.decisionTime, input.context.revisionPolicy);
      if (asOf.selected) {
        values.push({ instrumentId: member.instrumentId, valueMinor: asOf.selected.valueMinor });
      }
    }
    const rank = crossSectionalRankBps(values, input.instrumentId);
    if (rank === null) {
      if (input.context.missingnessPolicy === 'FAIL_CLOSED') {
        return err({ code: 'MISSING_FEATURE', message: `cross-section rank unavailable for ${def.featureId}` });
      }
      return ok(Object.freeze({ featureId: def.featureId, valueMinor: null, observationRef: null }));
    }
    return ok(Object.freeze({ featureId: def.featureId, valueMinor: rank, observationRef: null }));
  }

  return err({ code: 'MISSING_FEATURE', message: `unsupported compute kind for ${def.featureId}` });
}

export function compileFeatureVector(
  input: CompileFeatureVectorInput,
): Result<CompiledFeatureVector, CompilerFailure> {
  const guard = guardContext(input);
  if (guard) {
    return err(leakageFailure(guard));
  }

  const features: CompiledFeatureValue[] = [];
  const observationRefs: string[] = [];

  for (const def of input.featureDefinitions) {
    const compiled = compileOneFeature(input, def);
    if (!compiled.ok) {
      return compiled;
    }
    features.push(compiled.value);
    if (compiled.value.observationRef) {
      observationRefs.push(compiled.value.observationRef);
    }
  }

  return ok(
    Object.freeze({
      entityId: input.entityId,
      instrumentId: input.instrumentId,
      decisionTime: input.decisionTime,
      universeVersion: input.universeVersion,
      features: Object.freeze(features),
      compilerVersion: AAF04_COMPILER_VERSION,
    }),
  );
}

export function compilePointInTimeDatasetManifest(input: {
  readonly strategyEvaluationId: string;
  readonly decisionTimeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly universeVersion: string;
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTimes: readonly UtcInstant[];
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly context: FeatureCompilerContext;
}): Result<{ readonly manifest: PointInTimeDatasetManifest; readonly vectors: readonly CompiledFeatureVector[] }, CompilerFailure> {
  const featureVersions: Record<string, string> = {};
  for (const def of input.featureDefinitions) {
    featureVersions[def.featureId] = def.version;
  }

  const vectors: CompiledFeatureVector[] = [];
  const refs = new Set<string>();

  for (const decisionTime of input.decisionTimes) {
    const compiled = compileFeatureVector({
      entityId: input.entityId,
      instrumentId: input.instrumentId,
      decisionTime,
      universeVersion: input.universeVersion,
      featureDefinitions: input.featureDefinitions,
      context: input.context,
    });
    if (!compiled.ok) {
      return compiled;
    }
    vectors.push(compiled.value);
    for (const feature of compiled.value.features) {
      if (feature.observationRef) {
        refs.add(feature.observationRef);
      }
    }
  }

  const manifest = freezePointInTimeDatasetManifest({
    strategyEvaluationId: input.strategyEvaluationId,
    decisionTimeRange: input.decisionTimeRange,
    universeVersion: input.universeVersion,
    featureVersions,
    observationRefs: [...refs],
    entityResolutionVersion: input.context.entityResolutionVersion,
    revisionPolicy: input.context.revisionPolicy,
    missingnessPolicy: input.context.missingnessPolicy,
  });
  if (!manifest.ok) {
    return manifest;
  }

  return ok(Object.freeze({ manifest: manifest.value, vectors: Object.freeze(vectors) }));
}

export function reproduceVectorsFromManifest(input: {
  readonly manifest: PointInTimeDatasetManifest;
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTimes: readonly UtcInstant[];
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly context: FeatureCompilerContext;
}): Result<readonly CompiledFeatureVector[], CompilerFailure> {
  const vectors: CompiledFeatureVector[] = [];
  const refs = new Set<string>();
  for (const decisionTime of input.decisionTimes) {
    const compiled = compileFeatureVector({
      entityId: input.entityId,
      instrumentId: input.instrumentId,
      decisionTime,
      universeVersion: input.manifest.universeVersion,
      featureDefinitions: input.featureDefinitions,
      context: input.context,
    });
    if (!compiled.ok) {
      return compiled;
    }
    vectors.push(compiled.value);
    for (const feature of compiled.value.features) {
      if (feature.observationRef) {
        refs.add(feature.observationRef);
      }
    }
  }
  const sortedRefs = [...refs].sort((a, b) => a.localeCompare(b));
  const sortedManifestRefs = [...input.manifest.observationRefs].sort((a, b) => a.localeCompare(b));
  if (sortedRefs.join('|') !== sortedManifestRefs.join('|')) {
    return err({
      code: 'REPRODUCTION_MISMATCH',
      message: 'recompiled observation refs do not match manifest',
    });
  }
  return ok(Object.freeze(vectors));
}
