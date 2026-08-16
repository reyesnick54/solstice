use std::collections::BTreeMap;
use std::path::Path;
use std::time::Instant;

use sunrey_crypto::{CryptoSuite, SigningSecret};
use sunrey_protocol::Hash32;

use crate::app::{ConsensusApplication, ProposalContext};
use crate::commit::{CommitCertificate, FinalizedBlock};
use crate::error::ConsensusError;
use crate::evidence::Evidence;
use crate::message::{
    sign_domain_message, verify_domain_message, Proposal, ProposedValue, Vote, DOMAIN_PROPOSAL,
    PROTOCOL_VERSION,
};
use crate::metrics::ConsensusMetrics;
use crate::params::ConsensusParams;
use crate::signer::SignerSafetyStore;
use crate::types::{
    BlockId, ConsensusStep, Height, LockedValue, Round, RoundState, ValidValue, ValidatorId,
    VoteType,
};
use crate::valset::ValidatorSet;
use crate::voteset::VoteSet;
use crate::wal::{ConsensusWal, WalRecord};

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: String,
    pub local_id: ValidatorId,
}

impl EngineConfig {
    pub fn development(local_id: impl Into<ValidatorId>) -> Self {
        Self {
            network_id: sunrey_protocol::LOCAL_DEV_NETWORK_ID.to_string(),
            chain_id: sunrey_protocol::LOCAL_DEV_CHAIN_ID.to_string(),
            protocol_version: PROTOCOL_VERSION.to_string(),
            local_id: local_id.into(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TimeoutKind {
    Propose,
    Prevote,
    Precommit,
}

#[derive(Clone, Debug)]
pub enum ConsensusOutput {
    Proposal(Box<Proposal>),
    Vote(Vote),
    Finalized(Box<FinalizedBlock>),
    TimeoutScheduled { kind: TimeoutKind, height: Height, round: Round, delay_ms: u64 },
    Evidence(Box<Evidence>),
}

pub struct EnginePaths<'a> {
    pub wal: Option<&'a Path>,
    pub signer: Option<&'a Path>,
}

pub struct ConsensusEngine<A, S> {
    pub config: EngineConfig,
    pub suite: S,
    pub app: A,
    pub params: ConsensusParams,
    pub validators: ValidatorSet,
    pub state: RoundState,
    pub parent: Hash32,
    last_app_hash: Hash32,
    secret: Option<SigningSecret>,
    wal: ConsensusWal,
    signer: SignerSafetyStore,
    pub metrics: ConsensusMetrics,
    proposals: BTreeMap<u32, Proposal>,
    prevotes: BTreeMap<u32, VoteSet>,
    precommits: BTreeMap<u32, VoteSet>,
    pub commits: BTreeMap<u64, CommitCertificate>,
    pub evidence: Vec<Evidence>,
    pub last_finalized: Option<FinalizedBlock>,
    seen_prevote_quorum: BTreeMap<u32, bool>,
    seen_precommit_any: BTreeMap<u32, bool>,
    locked_this_round: BTreeMap<u32, bool>,
    started_at: Instant,
}

impl<A: ConsensusApplication, S: CryptoSuite> ConsensusEngine<A, S> {
    pub fn open(
        config: EngineConfig,
        suite: S,
        app: A,
        params: ConsensusParams,
        validators: ValidatorSet,
        secret: Option<SigningSecret>,
        paths: EnginePaths<'_>,
    ) -> Result<Self, ConsensusError> {
        params.validate()?;
        let wal = match paths.wal {
            Some(path) => ConsensusWal::open(path)?,
            None => ConsensusWal::in_memory(),
        };
        let signer = match paths.signer {
            Some(path) => SignerSafetyStore::open(path)?,
            None => SignerSafetyStore::in_memory(),
        };
        let mut engine = Self {
            config,
            suite,
            app,
            params,
            validators,
            state: RoundState::new_height(Height::FIRST),
            parent: [0u8; 32],
            last_app_hash: [0u8; 32],
            secret,
            wal,
            signer,
            metrics: ConsensusMetrics::default(),
            proposals: BTreeMap::new(),
            prevotes: BTreeMap::new(),
            precommits: BTreeMap::new(),
            commits: BTreeMap::new(),
            evidence: Vec::new(),
            last_finalized: None,
            seen_prevote_quorum: BTreeMap::new(),
            seen_precommit_any: BTreeMap::new(),
            locked_this_round: BTreeMap::new(),
            started_at: Instant::now(),
        };
        if !engine.wal.records().is_empty() {
            engine.recover_from_wal()?;
            engine
                .metrics
                .consensus_wal_recovery
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        } else {
            engine.wal.append(WalRecord::ValidatorSet(engine.validators.clone()))?;
            engine.state = RoundState::new_height(Height::FIRST);
            engine.wal.append(WalRecord::NewHeight { height: Height::FIRST })?;
            engine.sync_metrics();
        }
        Ok(engine)
    }

    pub fn recover_from_wal(&mut self) -> Result<Height, ConsensusError> {
        let records = self.wal.records().to_vec();
        for record in records {
            match record {
                WalRecord::ValidatorSet(set) => self.validators = set,
                WalRecord::NewHeight { height } => {
                    self.state = RoundState::new_height(height);
                    self.clear_round_maps();
                }
                WalRecord::NewRound { height, round, step } => {
                    self.state.height = height;
                    self.state.round = round;
                    self.state.step = step;
                }
                WalRecord::Proposal(proposal) => {
                    self.proposals.insert(proposal.value.round.get(), proposal);
                }
                WalRecord::Vote(vote) => {
                    let _ = self.store_vote_without_side_effects(vote);
                }
                WalRecord::Lock { height, round, block_id } => {
                    if height == self.state.height {
                        self.state.locked =
                            LockedValue { value: Some(block_id), round: Some(round) };
                    }
                }
                WalRecord::Valid { height, round, block_id } => {
                    if height == self.state.height {
                        self.state.valid = ValidValue { value: Some(block_id), round: Some(round) };
                    }
                }
                WalRecord::Commit(cert) => {
                    self.commits.insert(cert.height.get(), cert);
                    self.parent =
                        self.commits.values().last().map(|c| c.block_id.0).unwrap_or([0u8; 32]);
                }
                WalRecord::Signer(state) => self.signer.state = state,
            }
        }
        if let Some(height) = self.commits.keys().max().copied() {
            if self.state.height.get() <= height {
                self.state = RoundState::new_height(Height::new(height).increment()?);
                self.clear_round_maps();
            }
        }
        self.sync_metrics();
        Ok(self.state.height)
    }

    pub fn apply_validator_set(
        &mut self,
        next: ValidatorSet,
    ) -> Result<ValidatorSet, ConsensusError> {
        if self.state.step != ConsensusStep::NewHeight
            && self.state.step != ConsensusStep::Finalized
        {
            return Err(ConsensusError::ProposalRejected(
                "validator set changes only at height boundary",
            ));
        }
        self.validators = next;
        self.wal.append(WalRecord::ValidatorSet(self.validators.clone()))?;
        Ok(self.validators.clone())
    }

    pub fn submit_evidence(&mut self, evidence: Evidence) -> Result<(), ConsensusError> {
        self.evidence.push(evidence);
        Ok(())
    }

    pub fn start_round(&mut self, round: Round) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        if round.get() > self.params.max_round {
            return Err(ConsensusError::InvalidRound);
        }
        let _ = self.validators.sync_priorities(self.state.height, round)?;
        self.state.round = round;
        self.state.step = ConsensusStep::Propose;
        self.state.proposal_id = None;
        self.wal.append(WalRecord::NewRound {
            height: self.state.height,
            round,
            step: ConsensusStep::Propose,
        })?;
        self.sync_metrics();
        let mut outputs = Vec::new();
        let proposer = self.current_proposer()?;
        if proposer == self.config.local_id {
            if let Some(proposal) = self.build_local_proposal()? {
                outputs.push(ConsensusOutput::Proposal(Box::new(proposal.clone())));
                outputs.extend(self.receive_proposal(proposal)?);
            }
        } else {
            outputs.push(self.schedule(TimeoutKind::Propose));
        }
        Ok(outputs)
    }

    pub fn propose(
        &mut self,
        height: Height,
        round: Round,
        value: ProposedValue,
    ) -> Result<Proposal, ConsensusError> {
        if height != self.state.height || round != self.state.round {
            return Err(ConsensusError::InvalidHeight);
        }
        if self.current_proposer()? != self.config.local_id {
            return Err(ConsensusError::UnexpectedProposer);
        }
        self.sign_proposal(value, self.state.valid.round)
    }

    pub fn receive_proposal(
        &mut self,
        proposal: Proposal,
    ) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        self.metrics.proposal_received.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if let Err(err) = self.validate_proposal(&proposal) {
            self.metrics.proposal_rejected.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            return Err(err);
        }
        let round = proposal.value.round.get();
        if let Some(existing) = self.proposals.get(&round) {
            if existing.value.block_id(&self.suite) != proposal.value.block_id(&self.suite) {
                let evidence = Evidence::DoubleProposal {
                    validator_id: proposal.value.proposer.clone(),
                    first: Box::new(existing.clone()),
                    second: Box::new(proposal),
                };
                self.evidence.push(evidence.clone());
                return Ok(vec![ConsensusOutput::Evidence(Box::new(evidence))]);
            }
            return Ok(Vec::new());
        }
        self.proposals.insert(round, proposal.clone());
        self.wal.append(WalRecord::Proposal(proposal.clone()))?;
        self.state.proposal_id = Some(proposal.proposal_id(&self.suite));
        let mut outputs = Vec::new();
        if self.state.step == ConsensusStep::Propose && proposal.value.round == self.state.round {
            outputs.extend(self.maybe_prevote()?);
        }
        outputs.extend(self.maybe_lock_and_precommit()?);
        outputs.extend(self.maybe_commit()?);
        Ok(outputs)
    }

    pub fn prevote(
        &mut self,
        height: Height,
        round: Round,
        id: BlockId,
    ) -> Result<Vote, ConsensusError> {
        self.sign_vote(VoteType::Prevote, height, round, id)
    }

    pub fn precommit(
        &mut self,
        height: Height,
        round: Round,
        id: BlockId,
    ) -> Result<Vote, ConsensusError> {
        self.sign_vote(VoteType::Precommit, height, round, id)
    }

    pub fn receive_prevote(&mut self, vote: Vote) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        self.receive_vote(vote)
    }

    pub fn receive_precommit(
        &mut self,
        vote: Vote,
    ) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        self.receive_vote(vote)
    }

    pub fn on_timeout(
        &mut self,
        kind: TimeoutKind,
        height: Height,
        round: Round,
    ) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        if height != self.state.height || round != self.state.round {
            return Ok(Vec::new());
        }
        self.metrics.timeout_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        match kind {
            TimeoutKind::Propose if self.state.step == ConsensusStep::Propose => {
                self.emit_vote(VoteType::Prevote, BlockId::NIL)
            }
            TimeoutKind::Prevote if self.state.step == ConsensusStep::Prevote => {
                self.emit_vote(VoteType::Precommit, BlockId::NIL)
            }
            TimeoutKind::Precommit => {
                let next = self.state.round.increment()?;
                self.metrics.round_changes.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                self.start_round(next)
            }
            _ => Ok(Vec::new()),
        }
    }

    pub fn commit(
        &mut self,
        height: Height,
        block_id: BlockId,
    ) -> Result<FinalizedBlock, ConsensusError> {
        let cert =
            self.commits.get(&height.get()).cloned().ok_or(ConsensusError::QuorumNotReached)?;
        if cert.block_id != block_id {
            return Err(ConsensusError::InvalidCertificate("block id"));
        }
        let proposal = self
            .proposals
            .values()
            .find(|p| p.value.block_id(&self.suite) == block_id)
            .cloned()
            .ok_or(ConsensusError::ProposalRejected("missing proposal for commit"))?;
        Ok(FinalizedBlock {
            height: cert.height,
            round: cert.round,
            block_id: cert.block_id,
            value: proposal.value,
            certificate: cert,
            app_hash: self.app_hash_hint(),
        })
    }

    fn app_hash_hint(&self) -> Hash32 {
        self.last_app_hash
    }

    pub fn wal_status(&self) -> crate::wal::WalStatusView {
        self.wal.status()
    }

    pub fn current_proposer(&self) -> Result<ValidatorId, ConsensusError> {
        self.validators.select_proposer(self.state.height, self.state.round)
    }

    fn enter_new_height(&mut self, height: Height) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        self.state = RoundState::new_height(height);
        self.clear_round_maps();
        self.wal.append(WalRecord::NewHeight { height })?;
        self.sync_metrics();
        self.start_round(Round::ZERO)
    }

    fn clear_round_maps(&mut self) {
        self.proposals.clear();
        self.prevotes.clear();
        self.precommits.clear();
        self.seen_prevote_quorum.clear();
        self.seen_precommit_any.clear();
        self.locked_this_round.clear();
    }

    fn validate_proposal(&self, proposal: &Proposal) -> Result<(), ConsensusError> {
        let value = &proposal.value;
        if value.network_id != self.config.network_id || value.chain_id != self.config.chain_id {
            return Err(ConsensusError::WrongNetwork);
        }
        if value.protocol_version != self.config.protocol_version {
            return Err(ConsensusError::WrongProtocolVersion);
        }
        if value.height != self.state.height {
            return Err(ConsensusError::InvalidHeight);
        }
        if value.parent != self.parent {
            return Err(ConsensusError::WrongParent);
        }
        if value.validator_set_hash != self.validators.hash(&self.suite) {
            return Err(ConsensusError::WrongValidatorSetHash);
        }
        if value.validator_set_version != self.validators.version {
            return Err(ConsensusError::WrongValidatorSetHash);
        }
        if value.consensus_parameter_hash != self.params.hash(&self.suite) {
            return Err(ConsensusError::WrongConsensusParamsHash);
        }
        let expected = self.validators.select_proposer(value.height, value.round)?;
        if value.proposer != expected {
            return Err(ConsensusError::UnexpectedProposer);
        }
        let validator =
            self.validators.get(&value.proposer).ok_or(ConsensusError::UnknownValidator)?;
        verify_domain_message(
            &self.suite,
            &validator.public_key,
            DOMAIN_PROPOSAL,
            &proposal.encode_unsigned(),
            &proposal.signature,
        )?;
        if value.encoded_len() > self.params.max_block_bytes as usize {
            return Err(ConsensusError::BlockLimit);
        }
        if value.transactions.len() as u32 > self.params.max_transactions {
            return Err(ConsensusError::BlockLimit);
        }
        let ctx = ProposalContext {
            height: value.height,
            round: value.round,
            parent: value.parent,
            max_block_bytes: self.params.max_block_bytes,
            max_transactions: self.params.max_transactions,
        };
        self.app.validate_proposal(value, &ctx)?;
        Ok(())
    }

    fn should_prevote(&self, proposal: &Proposal) -> bool {
        let value_id = proposal.value.block_id(&self.suite);
        if self.state.locked.is_unlocked() {
            return true;
        }
        if self.state.locked.value == Some(value_id) {
            return true;
        }
        if let (Some(vr), Some(locked_round)) = (proposal.pol_round, self.state.locked.round) {
            if vr >= locked_round {
                if let Some(set) = self.prevotes.get(&vr.get()) {
                    return set.has_two_thirds_for(value_id, &self.validators).unwrap_or(false);
                }
            }
        }
        false
    }

    fn maybe_prevote(&mut self) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let proposal = match self.proposals.get(&self.state.round.get()) {
            Some(p) => p.clone(),
            None => return Ok(Vec::new()),
        };
        let id = if self.should_prevote(&proposal) {
            proposal.value.block_id(&self.suite)
        } else {
            BlockId::NIL
        };
        self.emit_vote(VoteType::Prevote, id)
    }

    fn emit_vote(
        &mut self,
        vote_type: VoteType,
        block_id: BlockId,
    ) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let vote = self.sign_vote(vote_type, self.state.height, self.state.round, block_id)?;
        let mut outputs = vec![ConsensusOutput::Vote(vote.clone())];
        outputs.extend(self.receive_vote(vote)?);
        Ok(outputs)
    }

    fn sign_vote(
        &mut self,
        vote_type: VoteType,
        height: Height,
        round: Round,
        block_id: BlockId,
    ) -> Result<Vote, ConsensusError> {
        let secret = self.secret.as_ref().ok_or(ConsensusError::NotLocalValidator)?;
        let step = match vote_type {
            VoteType::Prevote => ConsensusStep::Prevote,
            VoteType::Precommit => ConsensusStep::Precommit,
        };
        self.signer.authorize(height, round, step, block_id)?;
        let mut vote = Vote {
            vote_type,
            network_id: self.config.network_id.clone(),
            chain_id: self.config.chain_id.clone(),
            protocol_version: self.config.protocol_version.clone(),
            height,
            round,
            block_id,
            validator_id: self.config.local_id.clone(),
            validator_set_version: self.validators.version,
            signature: Vec::new(),
        };
        let domain = Vote::domain(vote_type);
        vote.signature = sign_domain_message(&self.suite, secret, domain, &vote.encode_unsigned())?;
        self.wal.append(WalRecord::Signer(self.signer.state.clone()))?;
        if vote_type == VoteType::Prevote && self.state.step == ConsensusStep::Propose {
            self.state.step = ConsensusStep::Prevote;
        }
        if vote_type == VoteType::Precommit && self.state.step == ConsensusStep::Prevote {
            self.state.step = ConsensusStep::Precommit;
        }
        Ok(vote)
    }

    fn sign_proposal(
        &mut self,
        value: ProposedValue,
        pol_round: Option<Round>,
    ) -> Result<Proposal, ConsensusError> {
        let secret = self.secret.as_ref().ok_or(ConsensusError::NotLocalValidator)?;
        let block_id = value.block_id(&self.suite);
        self.signer.authorize(value.height, value.round, ConsensusStep::Propose, block_id)?;
        let mut proposal = Proposal { value, pol_round, signature: Vec::new() };
        proposal.signature =
            sign_domain_message(&self.suite, secret, DOMAIN_PROPOSAL, &proposal.encode_unsigned())?;
        self.wal.append(WalRecord::Signer(self.signer.state.clone()))?;
        Ok(proposal)
    }

    fn build_local_proposal(&mut self) -> Result<Option<Proposal>, ConsensusError> {
        let (value, pol) = if let Some(valid_id) = self.state.valid.value {
            if let Some(proposal) =
                self.proposals.values().find(|p| p.value.block_id(&self.suite) == valid_id)
            {
                let mut value = proposal.value.clone();
                value.round = self.state.round;
                value.proposer = self.config.local_id.clone();
                (value, self.state.valid.round)
            } else {
                (self.fresh_proposal()?, None)
            }
        } else {
            (self.fresh_proposal()?, None)
        };
        Ok(Some(self.sign_proposal(value, pol)?))
    }

    fn fresh_proposal(&self) -> Result<ProposedValue, ConsensusError> {
        let ctx = ProposalContext {
            height: self.state.height,
            round: self.state.round,
            parent: self.parent,
            max_block_bytes: self.params.max_block_bytes,
            max_transactions: self.params.max_transactions,
        };
        let prepared = self.app.prepare_proposal(&ctx)?;
        Ok(ProposedValue {
            network_id: self.config.network_id.clone(),
            chain_id: self.config.chain_id.clone(),
            protocol_version: self.config.protocol_version.clone(),
            height: self.state.height,
            round: self.state.round,
            parent: self.parent,
            validator_set_hash: self.validators.hash(&self.suite),
            validator_set_version: self.validators.version,
            consensus_parameter_hash: self.params.hash(&self.suite),
            proposer: self.config.local_id.clone(),
            tx_root: prepared.tx_root,
            app_hash_proposal: prepared.app_hash_proposal,
            transactions: prepared.transactions,
            time_unix_ms: 1_700_000_000_000 + self.state.height.get() * 1_000,
        })
    }

    fn receive_vote(&mut self, vote: Vote) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        self.validate_vote(&vote)?;
        match vote.vote_type {
            VoteType::Prevote => {
                self.metrics.prevotes_received.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
            VoteType::Precommit => {
                self.metrics.precommits_received.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
        }
        if let Some((first, second)) = self.store_vote(vote.clone())? {
            let evidence = match vote.vote_type {
                VoteType::Prevote => {
                    Evidence::DoublePrevote { validator_id: vote.validator_id, first, second }
                }
                VoteType::Precommit => {
                    Evidence::DoublePrecommit { validator_id: vote.validator_id, first, second }
                }
            };
            self.evidence.push(evidence.clone());
            return Ok(vec![ConsensusOutput::Evidence(Box::new(evidence))]);
        }
        let mut outputs = Vec::new();
        if vote.vote_type == VoteType::Prevote {
            if let Some(set) = self.prevotes.get(&vote.round.get()) {
                self.metrics.voting_power_prevote.store(
                    set.total_power(&self.validators).unwrap_or(0),
                    std::sync::atomic::Ordering::Relaxed,
                );
                if set.has_two_thirds_any(&self.validators)?
                    && self.state.step == ConsensusStep::Prevote
                    && !*self.seen_prevote_quorum.get(&vote.round.get()).unwrap_or(&false)
                {
                    self.seen_prevote_quorum.insert(vote.round.get(), true);
                    outputs.push(self.schedule(TimeoutKind::Prevote));
                }
            }
            outputs.extend(self.maybe_lock_and_precommit()?);
        } else if let Some(set) = self.precommits.get(&vote.round.get()) {
            self.metrics.voting_power_precommit.store(
                set.total_power(&self.validators).unwrap_or(0),
                std::sync::atomic::Ordering::Relaxed,
            );
            if set.has_two_thirds_any(&self.validators)?
                && !*self.seen_precommit_any.get(&vote.round.get()).unwrap_or(&false)
            {
                self.seen_precommit_any.insert(vote.round.get(), true);
                outputs.push(self.schedule(TimeoutKind::Precommit));
            }
            outputs.extend(self.maybe_commit()?);
        }
        Ok(outputs)
    }

    fn validate_vote(&self, vote: &Vote) -> Result<(), ConsensusError> {
        if vote.network_id != self.config.network_id || vote.chain_id != self.config.chain_id {
            return Err(ConsensusError::WrongNetwork);
        }
        if vote.protocol_version != self.config.protocol_version {
            return Err(ConsensusError::WrongProtocolVersion);
        }
        if vote.height != self.state.height {
            return Err(ConsensusError::InvalidHeight);
        }
        if vote.validator_set_version != self.validators.version {
            return Err(ConsensusError::WrongValidatorSetHash);
        }
        let validator =
            self.validators.get(&vote.validator_id).ok_or(ConsensusError::UnknownValidator)?;
        verify_domain_message(
            &self.suite,
            &validator.public_key,
            Vote::domain(vote.vote_type),
            &vote.encode_unsigned(),
            &vote.signature,
        )
    }

    fn store_vote(&mut self, vote: Vote) -> Result<Option<(Vote, Vote)>, ConsensusError> {
        self.wal.append(WalRecord::Vote(vote.clone()))?;
        self.store_vote_without_side_effects(vote)
    }

    fn store_vote_without_side_effects(
        &mut self,
        vote: Vote,
    ) -> Result<Option<(Vote, Vote)>, ConsensusError> {
        let map = match vote.vote_type {
            VoteType::Prevote => &mut self.prevotes,
            VoteType::Precommit => &mut self.precommits,
        };
        let set = map
            .entry(vote.round.get())
            .or_insert_with(|| VoteSet::new(vote.vote_type, vote.height, vote.round));
        set.add(vote, &self.validators)
    }

    fn maybe_lock_and_precommit(&mut self) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let round = self.state.round.get();
        let proposal = match self.proposals.get(&round) {
            Some(p) => p.clone(),
            None => {
                if self.state.step == ConsensusStep::Prevote {
                    if let Some(set) = self.prevotes.get(&round) {
                        if set.has_two_thirds_nil(&self.validators)? {
                            return self.emit_vote(VoteType::Precommit, BlockId::NIL);
                        }
                    }
                }
                return Ok(Vec::new());
            }
        };
        let block_id = proposal.value.block_id(&self.suite);
        let Some(set) = self.prevotes.get(&round) else {
            return Ok(Vec::new());
        };
        if !set.has_two_thirds_for(block_id, &self.validators)? {
            if self.state.step == ConsensusStep::Prevote
                && set.has_two_thirds_nil(&self.validators)?
            {
                return self.emit_vote(VoteType::Precommit, BlockId::NIL);
            }
            return Ok(Vec::new());
        }
        let mut outputs = Vec::new();
        if self.state.step.rank() >= ConsensusStep::Prevote.rank()
            && !self.locked_this_round.get(&round).copied().unwrap_or(false)
        {
            self.state.valid = ValidValue { value: Some(block_id), round: Some(self.state.round) };
            self.wal.append(WalRecord::Valid {
                height: self.state.height,
                round: self.state.round,
                block_id,
            })?;
            if self.state.step == ConsensusStep::Prevote {
                self.state.locked =
                    LockedValue { value: Some(block_id), round: Some(self.state.round) };
                self.wal.append(WalRecord::Lock {
                    height: self.state.height,
                    round: self.state.round,
                    block_id,
                })?;
                self.metrics
                    .locked_round
                    .store(u64::from(self.state.round.get()), std::sync::atomic::Ordering::Relaxed);
                self.locked_this_round.insert(round, true);
                outputs.extend(self.emit_vote(VoteType::Precommit, block_id)?);
            } else {
                self.locked_this_round.insert(round, true);
            }
        }
        Ok(outputs)
    }

    fn maybe_commit(&mut self) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        let round = self.state.round.get();
        let Some(set) = self.precommits.get(&round) else {
            return Ok(Vec::new());
        };
        let Some(block_id) = set.quorum_block(&self.validators)? else {
            return Ok(Vec::new());
        };
        let Some(proposal) =
            self.proposals.values().find(|p| p.value.block_id(&self.suite) == block_id).cloned()
        else {
            return Ok(Vec::new());
        };
        if self.commits.contains_key(&self.state.height.get()) {
            return Ok(Vec::new());
        }
        self.state.step = ConsensusStep::Commit;
        self.sync_metrics();
        let cert = CommitCertificate::from_votes(
            &self.suite,
            &self.validators,
            self.state.height,
            self.state.round,
            block_id,
            set.matching(block_id),
        )?;
        let finalized = self.finalize(proposal, cert)?;
        Ok(vec![ConsensusOutput::Finalized(Box::new(finalized))])
    }

    fn finalize(
        &mut self,
        proposal: Proposal,
        cert: CommitCertificate,
    ) -> Result<FinalizedBlock, ConsensusError> {
        if self.commits.contains_key(&cert.height.get()) {
            return Err(ConsensusError::AlreadyFinalized);
        }
        cert.verify(&self.suite, &self.validators)?;
        self.wal.append(WalRecord::Commit(cert.clone()))?;
        let mut block = FinalizedBlock {
            height: cert.height,
            round: cert.round,
            block_id: cert.block_id,
            value: proposal.value,
            certificate: cert.clone(),
            app_hash: [0u8; 32],
        };
        let app_hash = self.app.apply_finalized(&block)?;
        block.app_hash = app_hash;
        self.last_app_hash = app_hash;
        self.commits.insert(cert.height.get(), cert.clone());
        self.parent = cert.block_id.0;
        self.state.decision = Some(cert.block_id);
        self.state.step = ConsensusStep::Finalized;
        self.metrics.commit_height.store(cert.height.get(), std::sync::atomic::Ordering::Relaxed);
        let elapsed = self.started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
        self.metrics.commit_latency_ms.store(elapsed, std::sync::atomic::Ordering::Relaxed);
        self.started_at = Instant::now();
        self.last_finalized = Some(block.clone());
        self.sync_metrics();
        Ok(block)
    }

    pub fn advance_after_finalized(&mut self) -> Result<Vec<ConsensusOutput>, ConsensusError> {
        if self.state.step != ConsensusStep::Finalized {
            return Err(ConsensusError::NotReady);
        }
        let next = self.state.height.increment()?;
        self.enter_new_height(next)
    }

    fn schedule(&self, kind: TimeoutKind) -> ConsensusOutput {
        let delay_ms = match kind {
            TimeoutKind::Propose => self.params.timeouts.propose_timeout_ms,
            TimeoutKind::Prevote => self.params.timeouts.prevote_timeout_ms,
            TimeoutKind::Precommit => self.params.timeouts.precommit_timeout_ms,
        };
        ConsensusOutput::TimeoutScheduled {
            kind,
            height: self.state.height,
            round: self.state.round,
            delay_ms,
        }
    }

    fn sync_metrics(&self) {
        self.metrics.set_step(
            self.state.height.get(),
            u64::from(self.state.round.get()),
            self.state.step.rank(),
        );
    }

    pub fn status_json(&self) -> serde_json::Value {
        serde_json::json!({
            "environment": "simulation",
            "network_id": self.config.network_id,
            "chain_id": self.config.chain_id,
            "height": self.state.height.get(),
            "round": self.state.round.get(),
            "step": self.state.step.as_str(),
            "locked_round": self.state.locked.round.map(Round::get),
            "valid_round": self.state.valid.round.map(Round::get),
            "local_validator": self.config.local_id.as_str(),
            "proposer": self.current_proposer().ok().map(|id| id.0),
            "commit_height": self.metrics.snapshot().commit_height,
            "metrics": self.metrics.snapshot(),
            "production_ready": false,
        })
    }
}
