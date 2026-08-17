import { SECURITY_CONTROLS } from './controls.ts';
import type { EvidenceKind, EvidenceLink } from './types.ts';

const KIND_BY_HINT: readonly { readonly needle: string; readonly kind: EvidenceKind }[] = [
  { needle: 'assurance/properties', kind: 'property' },
  { needle: 'assurance/consensus', kind: 'property' },
  { needle: 'assurance/coverage', kind: 'formal' },
  { needle: 'ALGORITHM.md', kind: 'formal' },
  { needle: 'fuzz', kind: 'fuzz' },
  { needle: 'sunrey-range', kind: 'adversarial' },
  { needle: 'ops/drills', kind: 'dr_drill' },
  { needle: 'ops.test', kind: 'dr_drill' },
  { needle: 'supply-chain', kind: 'supply_chain' },
  { needle: 'chunk-59', kind: 'supply_chain' },
  { needle: 'perf', kind: 'load' },
  { needle: 'sunrey-bench', kind: 'load' },
];

function classify(reference: string): EvidenceKind {
  for (const row of KIND_BY_HINT) {
    if (reference.includes(row.needle)) {
      return row.kind;
    }
  }
  return 'unit';
}

export function evidenceMap(): readonly EvidenceLink[] {
  const links: EvidenceLink[] = [];
  for (const control of SECURITY_CONTROLS) {
    for (const reference of control.testReferences) {
      links.push({
        control_id: control.control_id,
        kind: classify(reference),
        reference,
        reproducible: true,
      });
    }
    for (const reference of control.formalPropertyReferences) {
      links.push({
        control_id: control.control_id,
        kind: reference.includes('coverage') || reference.includes('ALGORITHM') ? 'formal' : 'property',
        reference,
        reproducible: true,
      });
    }
  }
  return Object.freeze(links);
}

export function evidenceKindsCovered(links: readonly EvidenceLink[] = evidenceMap()): readonly EvidenceKind[] {
  return Object.freeze([...new Set(links.map((row) => row.kind))]);
}
