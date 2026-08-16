use std::collections::BTreeMap;

use crate::chain::Block;
use crate::error::{NodeError, NodeResult};

use super::types::{Height, Round};
use super::validators::ValidatorSet;
use super::vote::CommitCertificate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalizedRecord {
    pub block: Block,
    pub certificate: CommitCertificate,
    pub validator_set_hash: [u8; 32],
    pub consensus_round: Round,
}

#[derive(Debug, Clone, Default)]
pub struct FinalizedStore {
    records: BTreeMap<Height, FinalizedRecord>,
}

impl FinalizedStore {
    pub fn insert(&mut self, record: FinalizedRecord) -> NodeResult<()> {
        let height = record.block.header.height;
        if let Some(existing) = self.records.get(&height) {
            if existing.block.block_id != record.block.block_id {
                return Err(NodeError::Validation(
                    "conflicting finalized block at height".into(),
                ));
            }
        }
        self.records.insert(height, record);
        Ok(())
    }

    pub fn finalized_height(&self) -> Height {
        self.records.keys().next_back().copied().unwrap_or(0)
    }

    pub fn finalized_block(&self, height: Height) -> Option<&Block> {
        self.records.get(&height).map(|r| &r.block)
    }

    pub fn commit_certificate(&self, height: Height) -> Option<&CommitCertificate> {
        self.records.get(&height).map(|r| &r.certificate)
    }

    pub fn consensus_round_at_commit(&self, height: Height) -> Option<Round> {
        self.records.get(&height).map(|r| r.consensus_round)
    }

    pub fn state_root_at_height(&self, height: Height) -> Option<[u8; 32]> {
        self.records.get(&height).map(|r| r.block.header.state_root)
    }

    pub fn record(&self, height: Height) -> Option<&FinalizedRecord> {
        self.records.get(&height)
    }
}

pub fn validator_set_at_height(set: &ValidatorSet, _height: Height) -> &ValidatorSet {
    set.at_height(_height)
}
