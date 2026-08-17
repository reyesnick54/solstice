import { type IncidentKind, type IncidentProcedure } from './types.ts';

const PROCEDURES: Readonly<Record<IncidentKind, Omit<IncidentProcedure, 'kind'>>> = {
  SIGNER_COMPROMISE: {
    isolateSigner: true,
    isolateSentries: false,
    rotateKeys: true,
    preserveEvidence: true,
    notifyGovernance: true,
    steps: [
      'fence the compromised signer lease',
      'stop signing on the affected host',
      'rotate the consensus key at the next epoch',
      'retain historical verification material',
    ],
  },
  DOUBLE_SIGN_SUSPECTED: {
    isolateSigner: true,
    isolateSentries: false,
    rotateKeys: false,
    preserveEvidence: true,
    notifyGovernance: true,
    steps: [
      'halt additional signatures',
      'export equivocation evidence without mutating it',
      'submit evidence to the accountability pool',
    ],
  },
  SENTRY_COMPROMISE: {
    isolateSigner: false,
    isolateSentries: true,
    rotateKeys: false,
    preserveEvidence: true,
    notifyGovernance: false,
    steps: [
      'disconnect the compromised sentry',
      'keep the validator on the remaining authenticated path',
      'rotate P2P keys for the replaced sentry',
    ],
  },
  KEY_MATERIAL_EXPOSURE: {
    isolateSigner: true,
    isolateSentries: true,
    rotateKeys: true,
    preserveEvidence: true,
    notifyGovernance: true,
    steps: [
      'treat the consensus key as burned',
      'schedule rotation and jail if policy requires',
      'never reprint or export the exposed material',
    ],
  },
  SNAPSHOT_TAMPER: {
    isolateSigner: false,
    isolateSentries: false,
    rotateKeys: false,
    preserveEvidence: true,
    notifyGovernance: true,
    steps: ['reject the snapshot', 're-bootstrap from genesis or a verified snapshot'],
  },
  DISK_EXHAUSTION: {
    isolateSigner: false,
    isolateSentries: false,
    rotateKeys: false,
    preserveEvidence: true,
    notifyGovernance: false,
    steps: ['enter maintenance mode', 'prune only policy-permitted classes', 'never prune WAL or signer safety'],
  },
  LEASE_FENCE_CONFLICT: {
    isolateSigner: true,
    isolateSentries: false,
    rotateKeys: false,
    preserveEvidence: true,
    notifyGovernance: true,
    steps: ['keep exactly one active signer', 'do not break the fence to restore availability'],
  },
};

export function incidentProcedure(kind: IncidentKind): IncidentProcedure {
  return Object.freeze({ kind, ...PROCEDURES[kind] });
}
