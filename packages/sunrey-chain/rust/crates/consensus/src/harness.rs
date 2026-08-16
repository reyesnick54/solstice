use std::collections::BTreeMap;
use std::path::PathBuf;

use sunrey_crypto::{DevEd25519Sha256Suite, SigningSecret};

use crate::app::MemoryApp;
use crate::engine::{ConsensusEngine, ConsensusOutput, EngineConfig, EnginePaths, TimeoutKind};
use crate::error::ConsensusError;
use crate::params::ConsensusParams;
use crate::types::{ConsensusStep, ValidatorId};
use crate::valset::{Validator, ValidatorSet};
use crate::FinalizedBlock;

pub const HARNESS_VALIDATORS: [&str; 4] = ["val_a", "val_b", "val_c", "val_d"];

pub type DevEngine = ConsensusEngine<MemoryApp, DevEd25519Sha256Suite>;

pub fn development_secret(label: &str) -> SigningSecret {
    use sha2::{Digest, Sha256};
    let digest =
        Sha256::digest(format!("SUNREY_CONSENSUS_DEV_KEY_{label}_NOT_FOR_PRODUCTION").as_bytes());
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    SigningSecret::from_bytes(bytes)
}

pub fn four_validator_set() -> Result<ValidatorSet, ConsensusError> {
    let mut validators = Vec::new();
    for id in HARNESS_VALIDATORS {
        let secret = development_secret(id);
        validators.push(Validator::new(id, secret.public_key(), 10));
    }
    ValidatorSet::new(1, validators)
}

pub struct HarnessNode {
    pub id: ValidatorId,
    pub engine: DevEngine,
}

pub struct FourValidatorHarness {
    pub nodes: BTreeMap<String, HarnessNode>,
    pub available: BTreeMap<String, bool>,
}

impl FourValidatorHarness {
    pub fn open_ephemeral() -> Result<Self, ConsensusError> {
        Self::open_with_dirs(None)
    }

    pub fn open_with_dirs(root: Option<PathBuf>) -> Result<Self, ConsensusError> {
        let set = four_validator_set()?;
        let params = ConsensusParams::development();
        let mut nodes = BTreeMap::new();
        for id in HARNESS_VALIDATORS {
            let secret = development_secret(id);
            let (wal, signer) = match &root {
                Some(dir) => {
                    let base = dir.join(id);
                    (Some(base.join("consensus.wal")), Some(base.join("signer.bin")))
                }
                None => (None, None),
            };
            let engine = ConsensusEngine::open(
                EngineConfig::development(id),
                DevEd25519Sha256Suite,
                MemoryApp::default(),
                params.clone(),
                set.clone(),
                Some(secret),
                EnginePaths { wal: wal.as_deref(), signer: signer.as_deref() },
            )?;
            nodes.insert(id.to_string(), HarnessNode { id: ValidatorId::from(id), engine });
        }
        let available = HARNESS_VALIDATORS.iter().map(|id| ((*id).to_string(), true)).collect();
        Ok(Self { nodes, available })
    }

    pub fn set_available(&mut self, id: &str, available: bool) {
        self.available.insert(id.to_string(), available);
    }

    pub fn drive_until_commit(
        &mut self,
        max_steps: usize,
    ) -> Result<FinalizedBlock, ConsensusError> {
        let mut pending = Vec::new();
        for node in self.nodes.values_mut() {
            if self.available.get(&node.id.0).copied().unwrap_or(false) {
                pending.extend(node.engine.start_round(crate::types::Round::ZERO)?);
            }
        }
        for _ in 0..max_steps {
            if let Some(finalized) = self.first_finalized() {
                return Ok(finalized);
            }
            if pending.is_empty() {
                break;
            }
            let batch = std::mem::take(&mut pending);
            pending.extend(self.deliver(batch)?);
        }
        self.first_finalized().ok_or(ConsensusError::QuorumNotReached)
    }

    pub fn fire_timeouts(&mut self) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let mut outputs = Vec::new();
        let ids: Vec<String> = self.nodes.keys().cloned().collect();
        for id in ids {
            if !self.available.get(&id).copied().unwrap_or(false) {
                continue;
            }
            let node = self.nodes.get_mut(&id).ok_or(ConsensusError::UnknownValidator)?;
            let height = node.engine.state.height;
            let round = node.engine.state.round;
            let kind = match node.engine.state.step {
                ConsensusStep::Propose => TimeoutKind::Propose,
                ConsensusStep::Prevote => TimeoutKind::Prevote,
                ConsensusStep::Precommit | ConsensusStep::Commit => TimeoutKind::Precommit,
                _ => continue,
            };
            outputs.extend(node.engine.on_timeout(kind, height, round)?);
        }
        Ok(outputs)
    }

    fn deliver(
        &mut self,
        batch: Vec<ConsensusOutput>,
    ) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let mut produced = Vec::new();
        for output in batch {
            match output {
                ConsensusOutput::Proposal(proposal) => {
                    for node in self.nodes.values_mut() {
                        if self.available.get(&node.id.0).copied().unwrap_or(false) {
                            if let Ok(more) = node.engine.receive_proposal(*proposal.clone()) {
                                produced.extend(more);
                            }
                        }
                    }
                }
                ConsensusOutput::Vote(vote) => {
                    for node in self.nodes.values_mut() {
                        if self.available.get(&node.id.0).copied().unwrap_or(false) {
                            match vote.vote_type {
                                crate::types::VoteType::Prevote => {
                                    if let Ok(more) = node.engine.receive_prevote(vote.clone()) {
                                        produced.extend(more);
                                    }
                                }
                                crate::types::VoteType::Precommit => {
                                    if let Ok(more) = node.engine.receive_precommit(vote.clone()) {
                                        produced.extend(more);
                                    }
                                }
                            }
                        }
                    }
                }
                ConsensusOutput::TimeoutScheduled { kind, height, round, .. } => {
                    // Timeouts do not change validation rules. The harness fires
                    // them only when the caller asks via `fire_timeouts`.
                    let _ = (kind, height, round);
                }
                ConsensusOutput::Finalized(_) | ConsensusOutput::Evidence(_) => {}
            }
        }
        Ok(produced)
    }

    fn first_finalized(&self) -> Option<FinalizedBlock> {
        self.nodes.values().find_map(|node| node.engine.last_finalized.clone())
    }
}
