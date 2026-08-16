//! Bounded evidence pool: verify-before-admit, dedup, age, gossip state.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use crate::error::{NodeError, NodeResult};
use crate::evidence::{
    verify_equivocation_evidence, EquivocationEvidence, EvidenceContext, EvidenceType,
    MAX_EVIDENCE_AGE_HEIGHTS, MAX_EVIDENCE_PER_BLOCK,
};
use crate::identity::unix_ms;
use crate::validators::ValidatorRuntime;

pub const MAX_POOL_SIZE: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvidencePoolState {
    Pending,
    Gossiped,
    Included,
    Processed,
}

impl EvidencePoolState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Gossiped => "GOSSIPED",
            Self::Included => "INCLUDED",
            Self::Processed => "PROCESSED",
        }
    }
}

#[derive(Debug, Clone)]
pub struct PooledEvidence {
    pub evidence: EquivocationEvidence,
    pub state: EvidencePoolState,
    pub admitted_height: u64,
    pub received_at_ms: u64,
}

#[derive(Debug, Clone, Default)]
pub struct EvidencePool {
    items: BTreeMap<[u8; 32], PooledEvidence>,
    persist_path: Option<PathBuf>,
}

impl EvidencePool {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open(dir: &Path) -> NodeResult<Self> {
        let path = dir.join("evidence-pool.json");
        let mut pool = Self {
            items: BTreeMap::new(),
            persist_path: Some(path.clone()),
        };
        if path.exists() {
            let text =
                std::fs::read_to_string(&path).map_err(|e| NodeError::Store(e.to_string()))?;
            if let Ok(stored) = serde_json::from_str::<Vec<StoredEvidence>>(&text) {
                for item in stored {
                    if let Ok(raw) = hex::decode(&item.encoded) {
                        if let Ok(evidence) = EquivocationEvidence::decode(&raw) {
                            let id = evidence.evidence_id();
                            pool.items.insert(
                                id,
                                PooledEvidence {
                                    evidence,
                                    state: match item.state.as_str() {
                                        "GOSSIPED" => EvidencePoolState::Gossiped,
                                        "INCLUDED" => EvidencePoolState::Included,
                                        "PROCESSED" => EvidencePoolState::Processed,
                                        _ => EvidencePoolState::Pending,
                                    },
                                    admitted_height: item.admitted_height,
                                    received_at_ms: item.received_at_ms,
                                },
                            );
                        }
                    }
                }
            }
        }
        Ok(pool)
    }

    fn persist(&self) {
        let Some(path) = &self.persist_path else {
            return;
        };
        let stored: Vec<StoredEvidence> = self
            .items
            .values()
            .filter_map(|item| {
                Some(StoredEvidence {
                    encoded: hex::encode(item.evidence.encode().ok()?),
                    state: item.state.as_str().into(),
                    admitted_height: item.admitted_height,
                    received_at_ms: item.received_at_ms,
                })
            })
            .collect();
        if let Ok(text) = serde_json::to_string_pretty(&stored) {
            let _ = std::fs::write(path, text);
        }
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn get(&self, id: &[u8; 32]) -> Option<&PooledEvidence> {
        self.items.get(id)
    }

    pub fn list(&self) -> Vec<&PooledEvidence> {
        self.items.values().collect()
    }

    pub fn admit(
        &mut self,
        evidence: EquivocationEvidence,
        runtime: &ValidatorRuntime,
        network_id: &str,
        chain_id: &str,
        current_height: u64,
        processed: &BTreeSet<[u8; 32]>,
    ) -> NodeResult<[u8; 32]> {
        let id = evidence.evidence_id();
        if self.items.contains_key(&id) || processed.contains(&id) {
            return Err(NodeError::Validation("duplicate evidence".into()));
        }
        let historical = runtime.set_at_height(evidence.offense_height());
        let ctx = EvidenceContext {
            network_id,
            chain_id,
            current_height,
            historical_set: historical,
            processed,
        };
        verify_equivocation_evidence(&evidence, &ctx)?;
        self.evict(current_height, processed);
        if self
            .items
            .values()
            .filter(|i| {
                matches!(
                    i.state,
                    EvidencePoolState::Pending | EvidencePoolState::Gossiped
                )
            })
            .count()
            >= MAX_POOL_SIZE
        {
            return Err(NodeError::Validation("evidence pool is full".into()));
        }
        self.items.insert(
            id,
            PooledEvidence {
                evidence,
                state: EvidencePoolState::Pending,
                admitted_height: current_height,
                received_at_ms: unix_ms(),
            },
        );
        self.persist();
        Ok(id)
    }

    pub fn mark_gossiped(&mut self, id: &[u8; 32]) {
        if let Some(item) = self.items.get_mut(id) {
            if item.state == EvidencePoolState::Pending {
                item.state = EvidencePoolState::Gossiped;
                self.persist();
            }
        }
    }

    pub fn mark_included(&mut self, id: &[u8; 32]) {
        if let Some(item) = self.items.get_mut(id) {
            item.state = EvidencePoolState::Included;
            self.persist();
        }
    }

    pub fn mark_processed(&mut self, id: &[u8; 32]) {
        if let Some(item) = self.items.get_mut(id) {
            item.state = EvidencePoolState::Processed;
            self.persist();
        }
    }

    pub fn select_for_block(&self, current_height: u64) -> Vec<EquivocationEvidence> {
        let mut pending: Vec<&PooledEvidence> = self
            .items
            .values()
            .filter(|item| {
                matches!(
                    item.state,
                    EvidencePoolState::Pending | EvidencePoolState::Gossiped
                ) && current_height
                    <= item
                        .evidence
                        .offense_height()
                        .saturating_add(MAX_EVIDENCE_AGE_HEIGHTS)
            })
            .collect();
        pending.sort_by(|a, b| {
            b.evidence
                .evidence_type
                .priority()
                .cmp(&a.evidence.evidence_type.priority())
                .then_with(|| a.evidence.hex_id().cmp(&b.evidence.hex_id()))
        });
        pending
            .into_iter()
            .take(MAX_EVIDENCE_PER_BLOCK)
            .map(|item| item.evidence.clone())
            .collect()
    }

    pub fn evict(&mut self, current_height: u64, processed: &BTreeSet<[u8; 32]>) {
        self.items.retain(|id, item| {
            if processed.contains(id) {
                return false;
            }
            if item.state == EvidencePoolState::Processed {
                return false;
            }
            current_height
                <= item
                    .evidence
                    .offense_height()
                    .saturating_add(MAX_EVIDENCE_AGE_HEIGHTS)
        });
        self.persist();
    }

    pub fn contains_type(&self, ty: EvidenceType) -> bool {
        self.items
            .values()
            .any(|item| item.evidence.evidence_type == ty)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct StoredEvidence {
    encoded: String,
    state: String,
    admitted_height: u64,
    received_at_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::consensus_vote::{ConsensusMessageType, SignedConsensusMessage};
    use crate::validators::four_validator_devnet;

    #[test]
    fn pool_dedups_and_prioritizes() {
        let (set, fixtures) = four_validator_devnet();
        let runtime = ValidatorRuntime::new(set.clone(), 4);
        let mut pool = EvidencePool::new();
        let processed = BTreeSet::new();
        let byz = &fixtures[3];
        let mk = |ty, block| {
            SignedConsensusMessage::sign(
                if ty == ConsensusMessageType::Proposal {
                    &byz.proposal
                } else {
                    &byz.consensus
                },
                "net_sunrey_development",
                "chn_sunrey_development",
                "val-d",
                1,
                0,
                ty,
                [block; 32],
                set.hash(),
            )
            .unwrap()
        };
        let prevote = EquivocationEvidence::from_conflicting(
            mk(ConsensusMessageType::Prevote, 1),
            mk(ConsensusMessageType::Prevote, 2),
        )
        .unwrap();
        let precommit = EquivocationEvidence::from_conflicting(
            mk(ConsensusMessageType::Precommit, 1),
            mk(ConsensusMessageType::Precommit, 2),
        )
        .unwrap();
        pool.admit(
            prevote.clone(),
            &runtime,
            "net_sunrey_development",
            "chn_sunrey_development",
            1,
            &processed,
        )
        .unwrap();
        assert!(pool
            .admit(
                prevote,
                &runtime,
                "net_sunrey_development",
                "chn_sunrey_development",
                1,
                &processed,
            )
            .is_err());
        pool.admit(
            precommit.clone(),
            &runtime,
            "net_sunrey_development",
            "chn_sunrey_development",
            1,
            &processed,
        )
        .unwrap();
        let selected = pool.select_for_block(1);
        assert_eq!(selected[0].evidence_type, EvidenceType::DoublePrecommit);
    }
}
