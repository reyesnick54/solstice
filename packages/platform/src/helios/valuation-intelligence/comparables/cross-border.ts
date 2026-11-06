import type { PeerCandidate, PeerExclusionRecord } from './types.ts';

export type CrossBorderPolicy = {
  readonly requireSameAccounting: boolean;
  readonly requireSameCurrency: boolean;
  readonly maxCountryRiskGapBps: number;
};

export type CrossBorderAssessment = {
  readonly comparable: boolean;
  readonly adjustmentBps: number;
  readonly reasons: readonly string[];
};

export function assessCrossBorderComparability(
  target: PeerCandidate,
  peer: PeerCandidate,
  policy: CrossBorderPolicy,
): CrossBorderAssessment {
  const reasons: string[] = [];
  let adjustmentBps = 0;

  if (policy.requireSameCurrency && target.classification.currency !== peer.classification.currency) {
    return Object.freeze({
      comparable: false,
      adjustmentBps: 0,
      reasons: Object.freeze(['CURRENCY_NOT_COMPARABLE']),
    });
  }

  if (policy.requireSameAccounting && target.accountingRegime !== peer.accountingRegime) {
    return Object.freeze({
      comparable: false,
      adjustmentBps: 0,
      reasons: Object.freeze(['INCOMPATIBLE_ACCOUNTING_REGIME']),
    });
  }

  if (target.taxStructureLabel && peer.taxStructureLabel && target.taxStructureLabel !== peer.taxStructureLabel) {
    reasons.push('tax_structure_mismatch');
    adjustmentBps += 25;
  }

  const targetCrp = target.countryRiskPremiumBps ?? 0;
  const peerCrp = peer.countryRiskPremiumBps ?? 0;
  const gap = Math.abs(targetCrp - peerCrp);
  if (gap > policy.maxCountryRiskGapBps) {
    return Object.freeze({
      comparable: false,
      adjustmentBps: 0,
      reasons: Object.freeze(['MATERIAL_COUNTRY_RISK_MISMATCH']),
    });
  }
  adjustmentBps += gap;

  if (target.classification.currency !== peer.classification.currency) {
    reasons.push('currency_translation_required');
    adjustmentBps += 50;
  }

  return Object.freeze({
    comparable: true,
    adjustmentBps,
    reasons: Object.freeze(reasons),
  });
}

export function applyCrossBorderFilters(
  target: PeerCandidate,
  peers: readonly PeerCandidate[],
  policy: CrossBorderPolicy,
): { readonly eligible: readonly PeerCandidate[]; readonly excluded: readonly PeerExclusionRecord[] } {
  const eligible: PeerCandidate[] = [];
  const excluded: PeerExclusionRecord[] = [];

  for (const peer of peers) {
    const assessment = assessCrossBorderComparability(target, peer, policy);
    if (!assessment.comparable) {
      const reason = assessment.reasons[0] ?? 'USER_CONSTRAINT';
      excluded.push(
        Object.freeze({
          peerId: peer.peerId,
          reason: mapReason(reason),
          detail: assessment.reasons.join('; '),
        }),
      );
      continue;
    }
    eligible.push(peer);
  }

  return Object.freeze({ eligible: Object.freeze(eligible), excluded: Object.freeze(excluded) });
}

function mapReason(reason: string): PeerExclusionRecord['reason'] {
  switch (reason) {
    case 'CURRENCY_NOT_COMPARABLE':
      return 'CURRENCY_NOT_COMPARABLE';
    case 'INCOMPATIBLE_ACCOUNTING_REGIME':
      return 'INCOMPATIBLE_ACCOUNTING_REGIME';
    case 'MATERIAL_COUNTRY_RISK_MISMATCH':
      return 'MATERIAL_COUNTRY_RISK_MISMATCH';
    default:
      return 'INCOMPATIBLE_TAX_STRUCTURE';
  }
}
