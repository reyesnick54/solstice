/**
 * AAFV2.3 — deterministic point-in-time dataset compiler (Strategy Lab / Genome gate).
 */

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { compileFeatureVector, type CompiledFeatureVector, type FeatureCompilerContext } from './compile.ts';
import { mapLegacyLeakageToAafv203, scanPointInTimeLeakage } from './leakage-scanner.ts';
import { freezeAafv203PointInTimeDatasetManifest } from './v2-manifest.ts';
import {
  revisionPolicyFromSelection,
  type Aafv203CompilerFailure,
  type DatasetQualification,
  type PointInTimeDataset,
  type PointInTimeDatasetRequest,
} from './v2-types.ts';
import { AAFV2_03_COMPILER_VERSION } from './v2-version.ts';

function sortedDecisionTimes(times: readonly UtcInstant[]): UtcInstant[] {
  return [...times].sort((a, b) => Date.parse(a) - Date.parse(b));
}

function featureDefinitionRef(featureId: string, version: string): string {
  return `${featureId}@${version}`;
}

export class PointInTimeDatasetCompiler {
  readonly compilerVersion = AAFV2_03_COMPILER_VERSION;

  compileDataset(request: PointInTimeDatasetRequest): Result<PointInTimeDataset, Aafv203CompilerFailure> {
    if (request.strategyGenomeId.length === 0) {
      return err({ code: 'INVALID_REQUEST', message: 'strategyGenomeId is required' });
    }
    if (request.decisionTimes.length === 0) {
      return err({ code: 'INVALID_REQUEST', message: 'decisionTimes must not be empty' });
    }
    if (request.universe.members.length === 0) {
      return err({ code: 'INVALID_REQUEST', message: 'universe.members must not be empty' });
    }

    const decisionTimes = sortedDecisionTimes(request.decisionTimes);
    const revisionPolicy = revisionPolicyFromSelection(request.informationTimePolicy.revisionSelectionPolicy);
    const context: FeatureCompilerContext = Object.freeze({
      observations: request.context.observations,
      universeMembership: request.universe.membershipRows,
      tickerHistory: request.context.tickerHistory ?? Object.freeze([]),
      corporateActionRevisions: request.context.corporateActionRevisions ?? Object.freeze([]),
      entityResolutionVersion: request.universe.entityGraphVersion,
      revisionPolicy,
      missingnessPolicy: request.informationTimePolicy.missingnessPolicy,
      indexId: request.universe.indexId,
    });

    const vectors: CompiledFeatureVector[] = [];
    const observationRefs = new Set<string>();
    const revisionRefs = new Set<string>(request.context.revisionRefs ?? []);

    for (const decisionTime of decisionTimes) {
      for (const member of request.universe.members) {
        const scan = scanPointInTimeLeakage({
          decisionTime,
          observations: request.context.observations,
          universeMembership: request.universe.membershipRows,
          tickerHistory: request.context.tickerHistory ?? [],
          corporateActionRevisions: request.context.corporateActionRevisions ?? [],
          instrumentId: member.instrumentId,
          indexId: request.universe.indexId,
        });
        if (scan) {
          return err({
            code: 'LEAKAGE_DETECTED',
            message: scan.message,
            leakageCode: scan.code,
            decisionTime,
            entityId: member.entityId,
            instrumentId: member.instrumentId,
          });
        }

        const compiled = compileFeatureVector({
          entityId: member.entityId,
          instrumentId: member.instrumentId,
          decisionTime,
          universeVersion: request.universe.version,
          featureDefinitions: request.featureDefinitions,
          context,
        });
        if (!compiled.ok) {
          const leakageObservation = request.context.observations.find((row) => {
            if (Date.parse(row.knowableAt) <= Date.parse(decisionTime)) {
              return false;
            }
            if (row.instrumentId && row.instrumentId !== member.instrumentId) {
              return false;
            }
            if (!row.instrumentId && row.entityId !== member.entityId) {
              return false;
            }
            return true;
          });
          const leakageCode =
            compiled.error.code === 'LEAKAGE_DETECTED' && compiled.error.leakageCode
              ? mapLegacyLeakageToAafv203(
                  {
                    code: compiled.error.leakageCode as never,
                    message: compiled.error.message,
                  },
                  leakageObservation ?? null,
                )
              : undefined;
          return err({
            code: compiled.error.code === 'LEAKAGE_DETECTED' ? 'LEAKAGE_DETECTED' : compiled.error.code,
            message: compiled.error.message,
            leakageCode,
            decisionTime,
            entityId: member.entityId,
            instrumentId: member.instrumentId,
          });
        }
        vectors.push(compiled.value);
        for (const feature of compiled.value.features) {
          if (feature.observationRef) {
            observationRefs.add(feature.observationRef);
          }
        }
      }
    }

    for (const row of request.context.observations) {
      if (row.revisionSequence > 0) {
        revisionRefs.add(`${row.observationRef}:r${String(row.revisionSequence)}`);
      }
    }

    const featureVersions: Record<string, string> = {};
    const featureDefinitionRefs: string[] = [];
    for (const def of request.featureDefinitions) {
      featureVersions[def.featureId] = def.version;
      featureDefinitionRefs.push(featureDefinitionRef(def.featureId, def.version));
    }

    const manifest = freezeAafv203PointInTimeDatasetManifest({
      strategyGenomeId: request.strategyGenomeId,
      decisionTimeRange: { start: decisionTimes[0]!, end: decisionTimes[decisionTimes.length - 1]! },
      universeVersion: request.universe.version,
      universeDefinition: request.universe.definition,
      entityGraphVersion: request.universe.entityGraphVersion,
      featureVersions,
      featureDefinitionRefs,
      observationRefs: [...observationRefs],
      revisionRefs: [...revisionRefs],
      sourceProviders: request.context.sourceProviders ?? [],
      qualityPolicies: request.context.qualityPolicies ?? ['AAFV2.3:LEAKAGE_SCAN'],
      entitlementState: request.context.entitlementState ?? 'UNKNOWN',
      transformVersions: request.context.transformVersions ?? {},
      informationTimePolicy: request.informationTimePolicy,
      revisionPolicy,
      missingnessPolicy: request.informationTimePolicy.missingnessPolicy,
    });
    if (!manifest.ok) {
      return err(manifest.error);
    }

    const qualification: DatasetQualification = Object.freeze({
      leakageScanPassed: true,
      manifestSealed: true,
      vectorCount: vectors.length,
      decisionTimeCount: decisionTimes.length,
      memberCount: request.universe.members.length,
    });

    return ok(
      Object.freeze({
        datasetId: manifest.value.datasetId ?? manifest.value.manifestId,
        manifest: manifest.value,
        vectors: Object.freeze(vectors),
        qualification,
      }),
    );
  }
}

export function createPointInTimeDatasetCompiler(): PointInTimeDatasetCompiler {
  return new PointInTimeDatasetCompiler();
}
