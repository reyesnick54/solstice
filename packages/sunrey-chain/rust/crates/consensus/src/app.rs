use sunrey_protocol::Hash32;

use crate::error::ConsensusError;
use crate::message::ProposedValue;
use crate::types::{Height, Round};
use crate::FinalizedBlock;

/// Application port. Uncommitted proposals must not mutate authoritative state.
pub trait ConsensusApplication {
    fn prepare_proposal(&self, ctx: &ProposalContext) -> Result<AppProposal, ConsensusError>;
    fn validate_proposal(
        &self,
        value: &ProposedValue,
        ctx: &ProposalContext,
    ) -> Result<(), ConsensusError>;
    fn apply_finalized(&mut self, block: &FinalizedBlock) -> Result<Hash32, ConsensusError>;
}

#[derive(Clone, Debug)]
pub struct ProposalContext {
    pub height: Height,
    pub round: Round,
    pub parent: Hash32,
    pub max_block_bytes: u32,
    pub max_transactions: u32,
}

#[derive(Clone, Debug, Default)]
pub struct AppProposal {
    pub transactions: Vec<Vec<u8>>,
    pub tx_root: Hash32,
    pub app_hash_proposal: Hash32,
}

/// In-memory application used by the four-validator harness.
///
/// `prepare_proposal` / `validate_proposal` never write `committed`.
/// Only `apply_finalized` appends.
#[derive(Clone, Debug, Default)]
pub struct MemoryApp {
    pub mempool: Vec<Vec<u8>>,
    pub committed: Vec<Hash32>,
    pub last_app_hash: Hash32,
}

impl MemoryApp {
    pub fn push_tx(&mut self, tx: Vec<u8>) {
        self.mempool.push(tx);
    }
}

impl ConsensusApplication for MemoryApp {
    fn prepare_proposal(&self, ctx: &ProposalContext) -> Result<AppProposal, ConsensusError> {
        let mut selected = Vec::new();
        let mut bytes = 0usize;
        for tx in &self.mempool {
            let next = bytes.checked_add(tx.len()).ok_or(ConsensusError::Overflow)?;
            if next > ctx.max_block_bytes as usize {
                break;
            }
            if selected.len() as u32 >= ctx.max_transactions {
                break;
            }
            selected.push(tx.clone());
            bytes = next;
        }
        Ok(app_proposal_from_txs(&selected))
    }

    fn validate_proposal(
        &self,
        value: &ProposedValue,
        ctx: &ProposalContext,
    ) -> Result<(), ConsensusError> {
        if value.transactions.len() as u32 > ctx.max_transactions {
            return Err(ConsensusError::BlockLimit);
        }
        if value.encoded_len() > ctx.max_block_bytes as usize {
            return Err(ConsensusError::BlockLimit);
        }
        let expected = app_proposal_from_txs(&value.transactions);
        if expected.tx_root != value.tx_root {
            return Err(ConsensusError::ProposalRejected("transaction root"));
        }
        Ok(())
    }

    fn apply_finalized(&mut self, block: &FinalizedBlock) -> Result<Hash32, ConsensusError> {
        let applied = app_proposal_from_txs(&block.value.transactions);
        self.committed.push(block.block_id.0);
        self.last_app_hash = applied.app_hash_proposal;
        self.mempool.retain(|tx| !block.value.transactions.contains(tx));
        Ok(self.last_app_hash)
    }
}

pub fn app_proposal_from_txs(transactions: &[Vec<u8>]) -> AppProposal {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"sunrey.app.txroot.v1");
    for tx in transactions {
        hasher.update((tx.len() as u32).to_be_bytes());
        hasher.update(tx);
    }
    let tx_root: Hash32 = hasher.finalize().into();
    let mut hasher = Sha256::new();
    hasher.update(b"sunrey.app.state.v1");
    hasher.update(tx_root);
    let app_hash_proposal = hasher.finalize().into();
    AppProposal { transactions: transactions.to_vec(), tx_root, app_hash_proposal }
}
