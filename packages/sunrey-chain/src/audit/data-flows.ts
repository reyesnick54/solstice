import type { DataFlow } from './types.ts';

export const DATA_FLOWS: readonly DataFlow[] = Object.freeze([
  {
    flow_id: 'DF-WALLET-RPC-CONSENSUS',
    title: 'wallet → RPC → consensus',
    nodes: [
      { id: 'wallet', label: 'wallet signer', trustBoundary: 'wallet_signer' },
      { id: 'rpc', label: 'public RPC', trustBoundary: 'public_rpc' },
      { id: 'mempool', label: 'validator mempool', trustBoundary: 'validator' },
      { id: 'consensus', label: 'BFT engine', trustBoundary: 'validator' },
    ],
    edges: [
      { from: 'wallet', to: 'rpc', data: 'signed transaction envelope', authenticated: true },
      { from: 'rpc', to: 'mempool', data: 'admitted transaction bytes', authenticated: false },
      { from: 'mempool', to: 'consensus', data: 'proposed block', authenticated: true },
    ],
  },
  {
    flow_id: 'DF-EXCHANGE-CUSTODY-CHAIN',
    title: 'Exchange → custody → chain',
    nodes: [
      { id: 'exchange', label: 'Exchange matching', trustBoundary: 'exchange' },
      { id: 'custody', label: 'institutional custody', trustBoundary: 'custody_hsm' },
      { id: 'chain', label: 'finalized native settlement', trustBoundary: 'validator' },
    ],
    edges: [
      { from: 'exchange', to: 'custody', data: 'reservation / withdrawal intent', authenticated: true },
      { from: 'custody', to: 'chain', data: 'policy-signed native transfer', authenticated: true },
      { from: 'chain', to: 'exchange', data: 'finalized receipt / DVP complete', authenticated: true },
    ],
  },
  {
    flow_id: 'DF-ORACLE-MOONREY',
    title: 'oracle → chain → productive contribution → MoonRey',
    nodes: [
      { id: 'oracle', label: 'oracle provider', trustBoundary: 'oracle_provider' },
      { id: 'facts', label: 'VerifiedEconomicFact', trustBoundary: 'validator' },
      { id: 'productive', label: 'productive claim', trustBoundary: 'validator' },
      { id: 'issuance', label: 'MoonRey issuance receipt', trustBoundary: 'governance_authority' },
    ],
    edges: [
      { from: 'oracle', to: 'facts', data: 'signed observation', authenticated: true },
      { from: 'facts', to: 'productive', data: 'admitted measurement', authenticated: true },
      { from: 'productive', to: 'issuance', data: 'fingerprint + formula v1', authenticated: true },
    ],
  },
  {
    flow_id: 'DF-INTEROP',
    title: 'interop relayer → light client → packet',
    nodes: [
      { id: 'relayer', label: 'relayer', trustBoundary: 'relayer' },
      { id: 'light', label: 'light client', trustBoundary: 'validator' },
      { id: 'packet', label: 'interchain packet', trustBoundary: 'validator' },
    ],
    edges: [
      { from: 'relayer', to: 'light', data: 'commit proof', authenticated: true },
      { from: 'light', to: 'packet', data: 'verified packet bytes', authenticated: true },
    ],
  },
  {
    flow_id: 'DF-PRIVACY-RIGHTS',
    title: 'PDV → Consent → Clean Room → information-right delivery',
    nodes: [
      { id: 'pdv', label: 'Personal Data Vault', trustBoundary: 'personal_data_vault' },
      { id: 'consent', label: 'Consent Ledger / Purpose Firewall', trustBoundary: 'personal_data_vault' },
      { id: 'clean', label: 'Clean Room', trustBoundary: 'clean_room' },
      { id: 'rights', label: 'information-right delivery', trustBoundary: 'external' },
    ],
    edges: [
      { from: 'pdv', to: 'consent', data: 'capability / permit, not raw payload', authenticated: true },
      { from: 'consent', to: 'clean', data: 'join token + purpose', authenticated: true },
      { from: 'clean', to: 'rights', data: 'constrained result, raw rows denied', authenticated: true },
    ],
  },
]);

export function emitDataFlowText(flow: DataFlow): string {
  const lines = [`# ${flow.title}`, `id: ${flow.flow_id}`, 'nodes:'];
  for (const node of flow.nodes) {
    lines.push(`  - ${node.id}: ${node.label} [${node.trustBoundary}]`);
  }
  lines.push('edges:');
  for (const edge of flow.edges) {
    lines.push(`  - ${edge.from} -> ${edge.to}: ${edge.data} (auth=${String(edge.authenticated)})`);
  }
  return `${lines.join('\n')}\n`;
}
