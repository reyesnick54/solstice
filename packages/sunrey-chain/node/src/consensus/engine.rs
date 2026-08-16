//! Tendermint-family ConsensusEngine. Application code sees finalized blocks only.

use std::collections::HashMap;
use std::time::Duration;

use crate::chain::Block;
use crate::error::{NodeError, NodeResult};
use crate::identity::unix_ms;

use super::evidence::{EquivocationEvidence, EvidenceKind};
use super::messages::ConsensusMessage;
use super::proposal::SignedProposal;
use super::signer::ConsensusSigner;
use super::store::{FinalizedRecord, FinalizedStore};
use super::types::{
    BlockId, ConsensusParams, Height, RejectReason, Round, Step, TimeoutKind, ValueLock, VoteType,
};
use super::validators::{ValidatorId, ValidatorSet};
use super::vote::{CommitCertificate, SignedVote, VoteInsert, VoteSet};
use super::wal::{ConsensusWal, WalRecord};

#[derive(Debug, Clone)]
pub enum Action {
    Broadcast(ConsensusMessage),
    RequestProposal {
        height: Height,
        round: Round,
        block_id: BlockId,
    },
    RequestCommit {
        height: Height,
    },
    NeedProposalBlock {
        height: Height,
        round: Round,
    },
    Finalize {
        block: Block,
        certificate: CommitCertificate,
    },
    ScheduleTimeout {
        kind: TimeoutKind,
        height: Height,
        round: Round,
        delay: Duration,
    },
    Evidence(EquivocationEvidence),
    Reject {
        reason: RejectReason,
    },
}

pub struct ConsensusEngine {
    pub local_id: ValidatorId,
    pub validators: ValidatorSet,
    pub params: ConsensusParams,
    pub network_id: String,
    pub chain_id: String,
    pub height: Height,
    pub round: Round,
    pub step: Step,
    pub locked: Option<ValueLock>,
    pub valid: Option<ValueLock>,
    pub proposals: HashMap<(Height, Round), SignedProposal>,
    pub blocks: HashMap<BlockId, Block>,
    pub pending_blocks: HashMap<(Height, Round), Block>,
    pub prevotes: HashMap<(Height, Round), VoteSet>,
    pub precommits: HashMap<(Height, Round), VoteSet>,
    pub store: FinalizedStore,
    pub signer: ConsensusSigner,
    pub wal: ConsensusWal,
    pub started: bool,
    height_started_ms: u64,
    voted_prevote: HashMap<(Height, Round), bool>,
    voted_precommit: HashMap<(Height, Round), bool>,
    round_hints: HashMap<(Height, Round), u32>,
}

impl ConsensusEngine {
    pub fn new(
        network_id: String,
        chain_id: String,
        validators: ValidatorSet,
        signer: ConsensusSigner,
        wal: ConsensusWal,
        params: ConsensusParams,
    ) -> Self {
        let local_id = signer.validator_id;
        Self {
            local_id,
            validators,
            params,
            network_id,
            chain_id,
            height: 1,
            round: 0,
            step: Step::NewHeight,
            locked: None,
            valid: None,
            proposals: HashMap::new(),
            blocks: HashMap::new(),
            pending_blocks: HashMap::new(),
            prevotes: HashMap::new(),
            precommits: HashMap::new(),
            store: FinalizedStore::default(),
            signer,
            wal,
            started: false,
            height_started_ms: unix_ms(),
            voted_prevote: HashMap::new(),
            voted_precommit: HashMap::new(),
            round_hints: HashMap::new(),
        }
    }

    pub fn recover(&mut self) -> NodeResult<Vec<Action>> {
        let records = self.wal.records.clone();
        let mut last_height = 1u64;
        let mut last_round = 0u32;
        let mut last_step = Step::Propose;
        for record in records {
            match record {
                WalRecord::NewHeight { height } => {
                    last_height = height.max(1);
                    last_round = 0;
                    last_step = Step::Propose;
                }
                WalRecord::NewRound {
                    height,
                    round,
                    step,
                } => {
                    last_height = height.max(last_height);
                    last_round = round;
                    last_step = step;
                }
                WalRecord::Proposal(proposal) => {
                    self.proposals
                        .insert((proposal.height, proposal.round), proposal);
                }
                WalRecord::Vote(vote) => {
                    let validators = self.validators.clone();
                    let set = self.vote_set(vote.vote_type, vote.height, vote.round);
                    let _ = set.insert(vote, &validators);
                }
                WalRecord::Commit(cert) => {
                    if let Some(block) = self.blocks.get(&cert.block_id).cloned() {
                        let _ = self.remember_final(block, cert);
                    }
                }
            }
        }
        let finalized = self.store.finalized_height();
        self.height = last_height.max(finalized.saturating_add(1)).max(1);
        self.round = last_round;
        self.step = last_step;
        if self.store.finalized_height() >= self.height {
            self.height = self.store.finalized_height() + 1;
            self.round = 0;
            self.step = Step::Propose;
        }
        Ok(Vec::new())
    }

    pub fn start(&mut self) -> Vec<Action> {
        self.started = true;
        self.enter_round(self.height, self.round)
    }

    pub fn finalized_height(&self) -> Height {
        self.store.finalized_height()
    }

    pub fn is_proposer(&self, height: Height, round: Round) -> bool {
        self.validators
            .proposer(height, round)
            .is_some_and(|v| v.id == self.local_id)
    }

    pub fn on_timeout(&mut self, kind: TimeoutKind, height: Height, round: Round) -> Vec<Action> {
        if height != self.height || round != self.round {
            return Vec::new();
        }
        match (kind, self.step) {
            (TimeoutKind::Propose, Step::Propose) => self.do_prevote(None),
            (TimeoutKind::Prevote, Step::Prevote) => self.do_precommit(None),
            (TimeoutKind::Precommit, Step::Precommit) => {
                self.enter_round(self.height, self.round + 1)
            }
            _ => Vec::new(),
        }
    }

    pub fn on_local_block(&mut self, block: Block) -> Vec<Action> {
        if block.header.height != self.height {
            return Vec::new();
        }
        if !self.is_proposer(self.height, self.round) || self.step != Step::Propose {
            self.blocks.insert(block.block_id, block);
            return Vec::new();
        }
        self.publish_proposal(block)
    }

    pub fn on_message(&mut self, message: ConsensusMessage) -> Vec<Action> {
        match message {
            ConsensusMessage::ProposalAnnouncement {
                height,
                round,
                block_id,
                proposal,
            } => self.on_proposal_announcement(height, round, block_id, proposal),
            ConsensusMessage::ProposalRequest {
                height,
                round,
                block_id,
            } => self.on_proposal_request(height, round, block_id),
            ConsensusMessage::ProposalResponse { proposal, block } => {
                self.on_proposal_response(proposal, block)
            }
            ConsensusMessage::Prevote(vote) => self.on_vote(vote),
            ConsensusMessage::Precommit(vote) => self.on_vote(vote),
            ConsensusMessage::CommitAnnouncement(cert) => self.on_commit(cert, None),
            ConsensusMessage::CommitRequest { height } => self.on_commit_request(height),
            ConsensusMessage::CommitResponse { certificate, block } => {
                self.on_commit(certificate, Some(block))
            }
            ConsensusMessage::RoundStateHint {
                height,
                round,
                step: _,
            } => self.on_round_hint(height, round),
            ConsensusMessage::EvidenceAnnouncement(_) => Vec::new(),
        }
    }

    fn enter_round(&mut self, height: Height, round: Round) -> Vec<Action> {
        if height < self.height {
            return Vec::new();
        }
        if height == self.height && round < self.round {
            return Vec::new();
        }
        self.height = height;
        self.round = round;
        self.step = Step::Propose;
        self.height_started_ms = unix_ms();
        let mut actions = Vec::new();
        let _ = self.wal.append(WalRecord::NewRound {
            height,
            round,
            step: Step::Propose,
        });
        actions.push(Action::Broadcast(ConsensusMessage::RoundStateHint {
            height,
            round,
            step: Step::Propose,
        }));
        actions.push(Action::ScheduleTimeout {
            kind: TimeoutKind::Propose,
            height,
            round,
            delay: self.params.timeout(TimeoutKind::Propose, round),
        });
        if self.is_proposer(height, round) {
            if let Some(lock) = self.valid {
                if let Some(block) = self.blocks.get(&lock.block_id).cloned() {
                    actions.extend(self.publish_proposal(block));
                    return actions;
                }
            }
            actions.push(Action::NeedProposalBlock { height, round });
        } else if let Some(proposal) = self.proposals.get(&(height, round)).cloned() {
            actions.extend(self.maybe_prevote_proposal(&proposal));
        }
        actions
    }

    fn publish_proposal(&mut self, block: Block) -> Vec<Action> {
        let polka = self.valid.map(|v| v.round);
        let proposal = match SignedProposal::sign(
            &mut self.signer,
            &self.network_id,
            &self.chain_id,
            self.height,
            self.round,
            block.block_id,
            polka,
        ) {
            Ok(proposal) => proposal,
            Err(_) => return self.do_prevote(None),
        };
        let _ = self.wal.append(WalRecord::Proposal(proposal.clone()));
        self.proposals
            .insert((proposal.height, proposal.round), proposal.clone());
        self.blocks.insert(block.block_id, block.clone());
        let mut actions = vec![
            Action::Broadcast(ConsensusMessage::ProposalAnnouncement {
                height: proposal.height,
                round: proposal.round,
                block_id: proposal.block_id,
                proposal: proposal.clone(),
            }),
            Action::Broadcast(ConsensusMessage::ProposalResponse {
                proposal: proposal.clone(),
                block,
            }),
        ];
        actions.extend(self.maybe_prevote_proposal(&proposal));
        actions
    }

    fn on_proposal_announcement(
        &mut self,
        height: Height,
        round: Round,
        block_id: BlockId,
        proposal: SignedProposal,
    ) -> Vec<Action> {
        if let Err(reason) = self.check_proposal(&proposal) {
            return vec![Action::Reject { reason }];
        }
        if let Some(existing) = self.proposals.get(&(height, round)) {
            if existing.block_id != proposal.block_id {
                let evidence = EquivocationEvidence::Proposal {
                    height,
                    round,
                    validator_id: proposal.validator_id,
                    first: existing.clone(),
                    second: proposal,
                };
                return vec![
                    Action::Evidence(evidence.clone()),
                    Action::Broadcast(ConsensusMessage::EvidenceAnnouncement(evidence)),
                    Action::Reject {
                        reason: RejectReason::ConflictingProposal,
                    },
                ];
            }
            return Vec::new();
        }
        self.proposals.insert((height, round), proposal.clone());
        if let Some(block) = self
            .pending_blocks
            .remove(&(height, round))
            .or_else(|| self.blocks.get(&block_id).cloned())
        {
            return self.accept_proposal_block(proposal, block);
        }
        vec![Action::RequestProposal {
            height,
            round,
            block_id,
        }]
    }

    fn on_proposal_request(&self, height: Height, round: Round, block_id: BlockId) -> Vec<Action> {
        match (
            self.proposals.get(&(height, round)).cloned(),
            self.blocks.get(&block_id).cloned(),
        ) {
            (Some(proposal), Some(block)) => {
                vec![Action::Broadcast(ConsensusMessage::ProposalResponse {
                    proposal,
                    block,
                })]
            }
            _ => Vec::new(),
        }
    }

    fn on_proposal_response(&mut self, proposal: SignedProposal, block: Block) -> Vec<Action> {
        if block.encoded_len_approx() > self.params.max_block_bytes {
            return vec![Action::Reject {
                reason: RejectReason::OversizedBlock,
            }];
        }
        if let Err(reason) = self.check_proposal(&proposal) {
            return vec![Action::Reject { reason }];
        }
        if proposal.block_id != block.block_id {
            return vec![Action::Reject {
                reason: RejectReason::IncorrectProposer,
            }];
        }
        if let Some(existing) = self.proposals.get(&(proposal.height, proposal.round)) {
            if existing.block_id != proposal.block_id {
                let evidence = EquivocationEvidence::Proposal {
                    height: proposal.height,
                    round: proposal.round,
                    validator_id: proposal.validator_id,
                    first: existing.clone(),
                    second: proposal,
                };
                return vec![
                    Action::Evidence(evidence.clone()),
                    Action::Broadcast(ConsensusMessage::EvidenceAnnouncement(evidence)),
                ];
            }
        }
        self.accept_proposal_block(proposal, block)
    }

    fn accept_proposal_block(&mut self, proposal: SignedProposal, block: Block) -> Vec<Action> {
        self.proposals
            .insert((proposal.height, proposal.round), proposal.clone());
        self.blocks.insert(block.block_id, block);
        self.maybe_prevote_proposal(&proposal)
    }

    fn maybe_prevote_proposal(&mut self, proposal: &SignedProposal) -> Vec<Action> {
        if proposal.height != self.height
            || proposal.round != self.round
            || self.step != Step::Propose
        {
            return Vec::new();
        }
        let allowed = match self.locked {
            None => true,
            Some(lock) => {
                lock.block_id == proposal.block_id
                    || proposal.polka_round.is_some_and(|vr| {
                        vr > lock.round && self.has_polka(proposal.height, vr, proposal.block_id)
                    })
            }
        };
        if allowed {
            self.do_prevote(Some(proposal.block_id))
        } else {
            self.do_prevote(None)
        }
    }

    fn do_prevote(&mut self, block_id: Option<BlockId>) -> Vec<Action> {
        if self.voted_prevote.contains_key(&(self.height, self.round)) {
            self.step = Step::Prevote;
            return Vec::new();
        }
        let vote = match SignedVote::sign(
            &mut self.signer,
            &self.network_id,
            &self.chain_id,
            self.height,
            self.round,
            VoteType::Prevote,
            block_id,
        ) {
            Ok(vote) => vote,
            Err(_) => {
                self.step = Step::Prevote;
                return Vec::new();
            }
        };
        self.voted_prevote.insert((self.height, self.round), true);
        self.step = Step::Prevote;
        let _ = self.wal.append(WalRecord::Vote(vote.clone()));
        let mut actions = vec![
            Action::Broadcast(ConsensusMessage::Prevote(vote.clone())),
            Action::ScheduleTimeout {
                kind: TimeoutKind::Prevote,
                height: self.height,
                round: self.round,
                delay: self.params.timeout(TimeoutKind::Prevote, self.round),
            },
        ];
        actions.extend(self.on_vote(vote));
        actions
    }

    fn do_precommit(&mut self, block_id: Option<BlockId>) -> Vec<Action> {
        if self
            .voted_precommit
            .contains_key(&(self.height, self.round))
        {
            self.step = Step::Precommit;
            return Vec::new();
        }
        let vote = match SignedVote::sign(
            &mut self.signer,
            &self.network_id,
            &self.chain_id,
            self.height,
            self.round,
            VoteType::Precommit,
            block_id,
        ) {
            Ok(vote) => vote,
            Err(_) => {
                self.step = Step::Precommit;
                return Vec::new();
            }
        };
        self.voted_precommit.insert((self.height, self.round), true);
        self.step = Step::Precommit;
        let _ = self.wal.append(WalRecord::Vote(vote.clone()));
        let mut actions = vec![
            Action::Broadcast(ConsensusMessage::Precommit(vote.clone())),
            Action::ScheduleTimeout {
                kind: TimeoutKind::Precommit,
                height: self.height,
                round: self.round,
                delay: self.params.timeout(TimeoutKind::Precommit, self.round),
            },
        ];
        actions.extend(self.on_vote(vote));
        actions
    }

    fn on_vote(&mut self, vote: SignedVote) -> Vec<Action> {
        if vote.network_id != self.network_id {
            return vec![Action::Reject {
                reason: RejectReason::WrongNetwork,
            }];
        }
        if vote.chain_id != self.chain_id {
            return vec![Action::Reject {
                reason: RejectReason::WrongChain,
            }];
        }
        if vote.height + 1 < self.height {
            return Vec::new();
        }
        let validators = self.validators.clone();
        if let Err(reason) = vote.verify(&validators) {
            return vec![Action::Reject { reason }];
        }
        let first_conflict = {
            let set = self.vote_set(vote.vote_type, vote.height, vote.round);
            match set.insert(vote.clone(), &validators) {
                Ok(VoteInsert::Duplicate) => return Vec::new(),
                Ok(VoteInsert::Accepted) => None,
                Err(RejectReason::ConflictingVote) => set.get(vote.validator_id).cloned(),
                Err(reason) => return vec![Action::Reject { reason }],
            }
        };
        if let Some(first) = first_conflict {
            let kind = match vote.vote_type {
                VoteType::Prevote => EvidenceKind::DoublePrevote,
                VoteType::Precommit => EvidenceKind::DoublePrecommit,
            };
            let evidence = EquivocationEvidence::Vote {
                kind,
                first,
                second: vote,
            };
            return vec![
                Action::Evidence(evidence.clone()),
                Action::Broadcast(ConsensusMessage::EvidenceAnnouncement(evidence)),
                Action::Reject {
                    reason: RejectReason::ConflictingVote,
                },
            ];
        }
        let higher_power = if vote.height == self.height && vote.round > self.round {
            self.vote_set(vote.vote_type, vote.height, vote.round)
                .total_power(&validators)
        } else {
            0
        };
        if higher_power > 0 && validators.has_fault_threshold(higher_power) {
            return self.enter_round(vote.height, vote.round);
        }
        self.after_vote(vote.vote_type)
    }

    fn after_vote(&mut self, vote_type: VoteType) -> Vec<Action> {
        let mut actions = Vec::new();
        if self.step == Step::Propose {
            if let Some(proposal) = self.proposals.get(&(self.height, self.round)).cloned() {
                actions.extend(self.maybe_prevote_proposal(&proposal));
            }
        }
        if vote_type == VoteType::Prevote || self.step == Step::Prevote {
            if let Some(id) = self
                .prevotes
                .get(&(self.height, self.round))
                .and_then(|set| set.quorum_block(&self.validators))
            {
                self.locked = Some(ValueLock {
                    round: self.round,
                    block_id: id,
                });
                self.valid = Some(ValueLock {
                    round: self.round,
                    block_id: id,
                });
                if self.step == Step::Prevote || self.step == Step::Propose {
                    actions.extend(self.do_precommit(Some(id)));
                }
            } else if self
                .prevotes
                .get(&(self.height, self.round))
                .is_some_and(|set| set.has_any_quorum(&self.validators))
                && self.step == Step::Prevote
            {
                actions.push(Action::ScheduleTimeout {
                    kind: TimeoutKind::Prevote,
                    height: self.height,
                    round: self.round,
                    delay: self.params.timeout(TimeoutKind::Prevote, self.round),
                });
            }
        }
        if let Some(id) = self
            .precommits
            .get(&(self.height, self.round))
            .and_then(|set| set.quorum_block(&self.validators))
        {
            actions.extend(self.try_commit(id));
        } else if self
            .precommits
            .get(&(self.height, self.round))
            .is_some_and(|set| set.has_any_quorum(&self.validators))
            && self.step == Step::Precommit
        {
            actions.push(Action::ScheduleTimeout {
                kind: TimeoutKind::Precommit,
                height: self.height,
                round: self.round,
                delay: self.params.timeout(TimeoutKind::Precommit, self.round),
            });
        }
        actions
    }

    fn try_commit(&mut self, block_id: BlockId) -> Vec<Action> {
        let Some(block) = self.blocks.get(&block_id).cloned() else {
            return vec![Action::RequestProposal {
                height: self.height,
                round: self.round,
                block_id,
            }];
        };
        let votes = self
            .precommits
            .get(&(self.height, self.round))
            .map(|set| {
                set.votes()
                    .filter(|v| v.block_id == Some(block_id))
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let cert = match CommitCertificate::from_votes(
            self.network_id.clone(),
            self.chain_id.clone(),
            self.height,
            self.round,
            block_id,
            block.header.state_root,
            &self.validators,
            votes,
        ) {
            Ok(cert) => cert,
            Err(reason) => return vec![Action::Reject { reason }],
        };
        self.finish_commit(block, cert)
    }

    fn on_commit(&mut self, cert: CommitCertificate, block: Option<Block>) -> Vec<Action> {
        if let Err(reason) = cert.verify(&self.validators) {
            return vec![Action::Reject { reason }];
        }
        if cert.network_id != self.network_id {
            return vec![Action::Reject {
                reason: RejectReason::WrongNetwork,
            }];
        }
        if cert.chain_id != self.chain_id {
            return vec![Action::Reject {
                reason: RejectReason::WrongChain,
            }];
        }
        if cert.height < self.height && self.store.finalized_block(cert.height).is_some() {
            return Vec::new();
        }
        let block = match block.or_else(|| self.blocks.get(&cert.block_id).cloned()) {
            Some(block) => block,
            None => {
                return vec![Action::RequestCommit {
                    height: cert.height,
                }];
            }
        };
        if block.block_id != cert.block_id || block.header.state_root != cert.state_root {
            return vec![Action::Reject {
                reason: RejectReason::MalformedCertificate,
            }];
        }
        self.finish_commit(block, cert)
    }

    fn finish_commit(&mut self, block: Block, cert: CommitCertificate) -> Vec<Action> {
        if let Some(existing) = self.store.commit_certificate(cert.height).cloned() {
            if existing.block_id == cert.block_id {
                self.merge_certificate(cert);
            }
            return Vec::new();
        }
        if let Err(err) = self.remember_final(block.clone(), cert.clone()) {
            return vec![Action::Reject {
                reason: if err.to_string().contains("conflicting") {
                    RejectReason::ConflictingProposal
                } else {
                    RejectReason::MalformedCertificate
                },
            }];
        }
        let _ = self.wal.append(WalRecord::Commit(cert.clone()));
        let _ = self.signer.mark_committed(cert.height);
        let next = cert.height + 1;
        self.locked = None;
        self.valid = None;
        self.height = next;
        self.round = 0;
        self.step = Step::NewHeight;
        let _ = self.wal.append(WalRecord::NewHeight { height: next });
        let mut actions = vec![
            Action::Broadcast(ConsensusMessage::CommitAnnouncement(cert.clone())),
            Action::Finalize {
                block,
                certificate: cert,
            },
        ];
        actions.extend(self.enter_round(next, 0));
        actions
    }

    fn merge_certificate(&mut self, cert: CommitCertificate) {
        let Some(existing) = self.store.commit_certificate(cert.height).cloned() else {
            return;
        };
        if existing.block_id != cert.block_id {
            return;
        }
        let mut votes = existing.votes;
        for vote in cert.votes {
            if !votes.iter().any(|v| v.validator_id == vote.validator_id) {
                votes.push(vote);
            }
        }
        votes.sort_by_key(|a| a.validator_id.0);
        if let Ok(merged) = CommitCertificate::from_votes(
            existing.network_id,
            existing.chain_id,
            existing.height,
            existing.round.min(cert.round),
            existing.block_id,
            existing.state_root,
            &self.validators,
            votes,
        ) {
            if let Some(block) = self.store.finalized_block(merged.height).cloned() {
                let _ = self.remember_final(block, merged);
            }
        }
    }

    fn remember_final(&mut self, block: Block, cert: CommitCertificate) -> NodeResult<()> {
        self.blocks.insert(block.block_id, block.clone());
        self.store.insert(FinalizedRecord {
            validator_set_hash: cert.validator_set_hash,
            consensus_round: cert.round,
            block,
            certificate: cert,
        })
    }

    fn on_commit_request(&self, height: Height) -> Vec<Action> {
        match (
            self.store.commit_certificate(height).cloned(),
            self.store.finalized_block(height).cloned(),
        ) {
            (Some(certificate), Some(block)) => {
                vec![Action::Broadcast(ConsensusMessage::CommitResponse {
                    certificate,
                    block,
                })]
            }
            _ => Vec::new(),
        }
    }

    fn on_round_hint(&mut self, height: Height, round: Round) -> Vec<Action> {
        if height < self.height {
            return Vec::new();
        }
        if height == self.height && round <= self.round {
            return Vec::new();
        }
        if height > self.height + self.params.max_future_height {
            return vec![Action::Reject {
                reason: RejectReason::FutureHeightSpam,
            }];
        }
        let count = {
            let entry = self.round_hints.entry((height, round)).or_default();
            *entry = entry.saturating_add(1);
            *entry
        };
        // f+1 hints (more than 1/3 power if each hint is one validator).
        if u64::from(count).saturating_mul(3) > self.validators.total_power() {
            return self.enter_round(height, round);
        }
        Vec::new()
    }

    fn check_proposal(&self, proposal: &SignedProposal) -> Result<(), RejectReason> {
        if proposal.network_id != self.network_id {
            return Err(RejectReason::WrongNetwork);
        }
        if proposal.chain_id != self.chain_id {
            return Err(RejectReason::WrongChain);
        }
        proposal.verify(&self.validators)
    }

    fn has_polka(&self, height: Height, round: Round, block_id: BlockId) -> bool {
        self.prevotes
            .get(&(height, round))
            .and_then(|set| set.quorum_block(&self.validators))
            == Some(block_id)
    }

    fn vote_set(&mut self, vote_type: VoteType, height: Height, round: Round) -> &mut VoteSet {
        let map = match vote_type {
            VoteType::Prevote => &mut self.prevotes,
            VoteType::Precommit => &mut self.precommits,
        };
        map.entry((height, round))
            .or_insert_with(|| VoteSet::new(height, round, vote_type))
    }

    pub fn apply_remote_block_for_catchup(&mut self, block: Block) {
        self.pending_blocks
            .insert((block.header.height, 0), block.clone());
        self.blocks.insert(block.block_id, block);
    }

    pub fn finality_latency_ms(&self) -> u64 {
        unix_ms().saturating_sub(self.height_started_ms)
    }
}

impl Block {
    fn encoded_len_approx(&self) -> usize {
        self.encode().map(|b| b.len()).unwrap_or(usize::MAX)
    }
}

pub fn refuse_if_conflicting_finality(existing: &Block, candidate: &Block) -> NodeResult<()> {
    if existing.header.height == candidate.header.height && existing.block_id != candidate.block_id
    {
        return Err(NodeError::Validation("conflicting finality refused".into()));
    }
    Ok(())
}
