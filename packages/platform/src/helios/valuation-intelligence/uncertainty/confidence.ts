import type {
  CrossModelDispersion,
  TerminalValueDependence,
  ValuationConfidenceEnvelope,
  ValuationConfidenceLevel,
  ValuationUncertaintyState,
} from './types.ts';

const POLICY_VERSION = 'val10-confidence-v1' as const;

/**
 * Deterministic confidence policy — no LLM involvement.
 * Valuations without uncertainty analysis cannot receive HIGH confidence.
 */
export function buildValuationConfidenceEnvelope(input: {
  readonly uncertainty: ValuationUncertaintyState | null;
  readonly terminalDependence: TerminalValueDependence | null;
  readonly fragilityIndex: number;
  readonly crossModel: CrossModelDispersion | null;
  readonly accountingSpreadRatio: number | null;
  readonly dataQualityFlags: readonly string[];
  readonly entityResolutionFlags: readonly string[];
  readonly pathCount: number;
}): ValuationConfidenceEnvelope {
  const drivers: string[] = [];

  if (!input.uncertainty || input.pathCount < 32) {
    drivers.push('missing_or_insufficient_monte_carlo_attribution');
    return envelope('INSUFFICIENT_DATA', drivers, true);
  }

  if (input.dataQualityFlags.length > 0) {
    drivers.push(`data_quality_flags:${input.dataQualityFlags.length}`);
  }
  if (input.entityResolutionFlags.length > 0) {
    drivers.push(`entity_resolution_flags:${input.entityResolutionFlags.length}`);
  }

  let score = 1;

  const sqrtVar = Math.sqrt(Math.max(input.uncertainty.totalEnterpriseValueVariance, 0));
  if (sqrtVar > 0 && input.uncertainty.enterpriseValueStdDev / sqrtVar < 0.85) {
    score -= 0.05;
    drivers.push('enterprise_value_stddev_inconsistent_with_variance');
  }
  if (input.uncertainty.enterpriseValueStdDev > 750) {
    score -= 0.12;
    drivers.push('elevated_enterprise_value_dispersion');
  }

  if (input.terminalDependence) {
    if (input.terminalDependence.severity === 'EXTREME') {
      score -= 0.35;
      drivers.push('terminal_value_share_extreme');
    } else if (input.terminalDependence.severity === 'HIGH') {
      score -= 0.25;
      drivers.push('terminal_value_share_high');
    } else if (input.terminalDependence.severity === 'MODERATE') {
      score -= 0.12;
      drivers.push('terminal_value_share_moderate');
    }
  }

  if (input.fragilityIndex >= 0.2) {
    score -= 0.2;
    drivers.push('fragility_index_elevated');
  } else if (input.fragilityIndex >= 0.1) {
    score -= 0.1;
    drivers.push('fragility_index_moderate');
  }

  if (input.crossModel) {
    if (input.crossModel.disagreementSeverity === 'HIGH') {
      score -= 0.3;
      drivers.push('cross_model_disagreement_high');
    } else if (input.crossModel.disagreementSeverity === 'MODERATE') {
      score -= 0.18;
      drivers.push('cross_model_disagreement_moderate');
    }
    if (input.crossModel.reverseDcfConsistencyFailures.length > 0) {
      score -= 0.1;
      drivers.push('reverse_dcf_inconsistency');
    }
  }

  if (input.accountingSpreadRatio !== null && input.accountingSpreadRatio >= 0.15) {
    score -= 0.15;
    drivers.push('accounting_state_spread_elevated');
  }

  if (input.dataQualityFlags.length >= 2) score -= 0.15;
  if (input.entityResolutionFlags.length >= 1) score -= 0.2;

  const level = scoreToLevel(score);
  const highBlocked = level !== 'HIGH';
  if (highBlocked && level !== 'INSUFFICIENT_DATA') {
    drivers.push('uncertainty_analysis_required_for_high_confidence_research');
  }

  return envelope(level, drivers, highBlocked);
}

function scoreToLevel(score: number): ValuationConfidenceLevel {
  if (score >= 0.82) return 'HIGH';
  if (score >= 0.62) return 'MEDIUM';
  if (score >= 0.42) return 'LOW';
  return 'VERY_LOW';
}

function envelope(
  level: ValuationConfidenceLevel,
  drivers: readonly string[],
  highConfidenceResearchBlocked: boolean,
): ValuationConfidenceEnvelope {
  return Object.freeze({
    level,
    policyVersion: POLICY_VERSION,
    drivers: Object.freeze([...drivers]),
    highConfidenceResearchBlocked,
  });
}
