import type { ReviewerChecklistItem } from './types.ts';

export const REVIEWER_CHECKLIST: readonly ReviewerChecklistItem[] = Object.freeze([
  {
    item_id: 'CHK-CONSENSUS-SAFETY',
    topic: 'consensus safety',
    prompt: 'Confirm lock rules, quorum arithmetic, and no longest-chain reorganization.',
    relatedControls: ['CTL-CONSENSUS-QUORUM', 'CTL-CONSENSUS-LOCK'],
  },
  {
    item_id: 'CHK-KEY-ISOLATION',
    topic: 'key isolation',
    prompt: 'Confirm validator, wallet, custody, governance, and release keys are purpose-separated.',
    relatedControls: ['CTL-KEY-PURPOSE-SEPARATION', 'CTL-SIGNER-SEPARATION'],
  },
  {
    item_id: 'CHK-CRYPTOSUITE',
    topic: 'CryptoSuite policy',
    prompt: 'Confirm unknown algorithm IDs fail closed and suite lifecycle is immutable after construction.',
    relatedControls: ['CTL-SUITE-LIFECYCLE'],
  },
  {
    item_id: 'CHK-DOWNGRADE',
    topic: 'downgrade resistance',
    prompt: 'Confirm hybrid AND-verification and rejected classical-only origination under CLASSICAL_AND_PQ.',
    relatedControls: ['CTL-HYBRID-AND', 'CTL-DOWNGRADE-REJECT'],
  },
  {
    item_id: 'CHK-REPLAY',
    topic: 'replay protection',
    prompt: 'Confirm bindings include network, chain, protocol, schema, domain, and payload hash.',
    relatedControls: ['CTL-REPLAY-BINDING', 'CTL-INTEROP-ONCE'],
  },
  {
    item_id: 'CHK-SUPPLY',
    topic: 'supply invariants',
    prompt: 'Confirm SunRey/MoonRey supply, fees, locks, and productive issuance invariants.',
    relatedControls: ['CTL-NATIVE-SUPPLY', 'CTL-MOONREY-FINGERPRINT', 'CTL-FEE-RESERVE'],
  },
  {
    item_id: 'CHK-AUTHORIZATION',
    topic: 'authorization',
    prompt: 'Confirm wallet multi-auth, custody policy, and machine mandates. Agents cannot execute.',
    relatedControls: ['CTL-MULTI-AUTH', 'CTL-CUSTODY-POLICY', 'CTL-MACHINE-MANDATE'],
  },
  {
    item_id: 'CHK-PRIVACY',
    topic: 'privacy',
    prompt: 'Confirm raw subject-level information is unavailable through Explorer, metrics, and Clean Room outputs.',
    relatedControls: ['CTL-PDV-ENCRYPT', 'CTL-PURPOSE-FIREWALL', 'CTL-EXPLORER-EXPOSURE'],
  },
  {
    item_id: 'CHK-UPGRADE',
    topic: 'upgrade governance',
    prompt: 'Confirm software release does not activate protocol change. UpgradePlan is height-activated.',
    relatedControls: ['CTL-GOVERNANCE-HEIGHT', 'CTL-RELEASE-NOT-PROTOCOL'],
  },
  {
    item_id: 'CHK-SUPPLY-CHAIN',
    topic: 'supply chain',
    prompt: 'Confirm SBOM, provenance, lockfiles, and tamper-evident release signatures.',
    relatedControls: ['CTL-DEPENDENCY-POLICY', 'CTL-SBOM', 'CTL-RELEASE-SIGN'],
  },
  {
    item_id: 'CHK-RECOVERY',
    topic: 'recovery',
    prompt: 'Confirm backup, failover, and DR drill evidence. SLOs are engineering targets.',
    relatedControls: ['CTL-BACKUP', 'CTL-DR-DRILLS', 'CTL-MULTI-DOMAIN'],
  },
  {
    item_id: 'CHK-OPERATIONS',
    topic: 'operational controls',
    prompt: 'Confirm sentry/signer topology, seven-validator development network, and secret-free reviewer config.',
    relatedControls: ['CTL-SIGNER-SEPARATION', 'CTL-SIGNER-WAL'],
  },
]);
