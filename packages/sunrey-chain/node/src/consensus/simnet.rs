//! Deterministic in-process consensus network for safety and chaos tests.

use std::collections::{HashMap, HashSet, VecDeque};
use std::time::Duration;

use crate::chain::{Block, DevChain, Genesis, Transaction};
use crate::error::{NodeError, NodeResult};
use crate::identity::unix_ms;

use super::engine::{Action, ConsensusEngine};
use super::fixture::FourValidatorFixture;
use super::messages::ConsensusMessage;
use super::signer::ConsensusSigner;
use super::types::{Height, RejectReason, TimeoutKind};
use super::validators::ValidatorId;
use super::wal::ConsensusWal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PacketFate {
    Deliver,
    Drop,
    Duplicate,
    Delay(u32),
}

#[derive(Debug, Clone)]
struct Envelope {
    from: ValidatorId,
    to: ValidatorId,
    message: ConsensusMessage,
    deliver_at: u64,
}

pub struct SimNode {
    pub name: String,
    pub engine: ConsensusEngine,
    pub chain: DevChain,
    pub online: bool,
    pub paused: bool,
    pending_timeouts: Vec<(TimeoutKind, u64, u32, u64)>,
    clock: u64,
}

pub struct SimNet {
    pub nodes: HashMap<ValidatorId, SimNode>,
    order: Vec<ValidatorId>,
    inbox: VecDeque<Envelope>,
    partitions: HashSet<(ValidatorId, ValidatorId)>,
    drop: HashSet<(ValidatorId, ValidatorId)>,
    delay: HashMap<(ValidatorId, ValidatorId), u32>,
    duplicate: HashSet<(ValidatorId, ValidatorId)>,
    pub clock: u64,
    pub evidence: Vec<super::evidence::EquivocationEvidence>,
    pub rejects: Vec<RejectReason>,
}

impl SimNet {
    pub fn four_honest(fixture: &FourValidatorFixture) -> Self {
        let mut nodes = HashMap::new();
        let mut order = Vec::new();
        for (i, item) in fixture.validators.iter().enumerate() {
            let signer = ConsensusSigner::new(item.consensus_key.clone()).expect("signer");
            let id = signer.validator_id;
            let engine = ConsensusEngine::new(
                fixture.genesis.network_id.clone(),
                fixture.genesis.chain_id.clone(),
                fixture.set.clone(),
                signer,
                ConsensusWal::memory(),
                fixture.params,
            );
            order.push(id);
            nodes.insert(
                id,
                SimNode {
                    name: item.name.clone(),
                    engine,
                    chain: DevChain::new(fixture.genesis.clone()),
                    online: i < 4,
                    paused: false,
                    pending_timeouts: Vec::new(),
                    clock: 0,
                },
            );
            let _ = i;
        }
        Self {
            nodes,
            order,
            inbox: VecDeque::new(),
            partitions: HashSet::new(),
            drop: HashSet::new(),
            delay: HashMap::new(),
            duplicate: HashSet::new(),
            clock: 0,
            evidence: Vec::new(),
            rejects: Vec::new(),
        }
    }

    pub fn start_all(&mut self) {
        let ids: Vec<_> = self.order.clone();
        for id in ids {
            let actions = self.nodes.get_mut(&id).unwrap().engine.start();
            self.dispatch(id, actions);
        }
    }

    pub fn set_online(&mut self, name: &str, online: bool) {
        if let Some(node) = self.by_name_mut(name) {
            node.online = online;
        }
    }

    pub fn pause(&mut self, name: &str, paused: bool) {
        if let Some(node) = self.by_name_mut(name) {
            node.paused = paused;
        }
    }

    pub fn partition_groups(&mut self, left: &[&str], right: &[&str]) {
        self.partitions.clear();
        let left_ids = self.ids_named(left);
        let right_ids = self.ids_named(right);
        for a in &left_ids {
            for b in &right_ids {
                self.partitions.insert((*a, *b));
                self.partitions.insert((*b, *a));
            }
        }
    }

    pub fn heal(&mut self) {
        self.partitions.clear();
        self.drop.clear();
        let ids: Vec<_> = self.order.clone();
        for id in ids {
            let messages = {
                let Some(node) = self.nodes.get(&id) else {
                    continue;
                };
                if !node.online {
                    continue;
                }
                let mut messages = vec![ConsensusMessage::RoundStateHint {
                    height: node.engine.height,
                    round: node.engine.round,
                    step: node.engine.step,
                }];
                for set in node.engine.prevotes.values() {
                    for vote in set.votes() {
                        messages.push(ConsensusMessage::Prevote(vote.clone()));
                    }
                }
                for set in node.engine.precommits.values() {
                    for vote in set.votes() {
                        messages.push(ConsensusMessage::Precommit(vote.clone()));
                    }
                }
                for ((height, round), proposal) in &node.engine.proposals {
                    if let Some(block) = node.engine.blocks.get(&proposal.block_id) {
                        messages.push(ConsensusMessage::ProposalResponse {
                            proposal: proposal.clone(),
                            block: block.clone(),
                        });
                    }
                    let _ = (height, round);
                }
                messages
            };
            for message in messages {
                for to in self.order.clone() {
                    if to != id {
                        self.enqueue(id, to, message.clone());
                    }
                }
            }
        }
    }

    pub fn drop_path(&mut self, from: &str, to: &str) {
        if let (Some(a), Some(b)) = (self.id_named(from), self.id_named(to)) {
            self.drop.insert((a, b));
        }
    }

    pub fn delay_path(&mut self, from: &str, to: &str, ticks: u32) {
        if let (Some(a), Some(b)) = (self.id_named(from), self.id_named(to)) {
            self.delay.insert((a, b), ticks);
        }
    }

    pub fn duplicate_path(&mut self, from: &str, to: &str) {
        if let (Some(a), Some(b)) = (self.id_named(from), self.id_named(to)) {
            self.duplicate.insert((a, b));
        }
    }

    pub fn submit_tx(&mut self, name: &str, tx: Transaction) -> NodeResult<()> {
        let node = self
            .by_name_mut(name)
            .ok_or_else(|| NodeError::Validation("unknown validator".into()))?;
        node.chain.validate_tx_stateless(&tx, unix_ms())?;
        node.chain.validate_tx_stateful(&tx)?;
        // Held in a one-tx mempool on the local chain proposal path.
        node.engine.apply_remote_block_for_catchup(
            node.chain
                .propose_block(vec![tx], unix_ms())
                .unwrap_or_else(|_| {
                    node.chain
                        .propose_block(Vec::new(), unix_ms())
                        .expect("empty")
                }),
        );
        Ok(())
    }

    pub fn step_until_height(&mut self, height: Height, max_steps: usize) -> NodeResult<()> {
        for _ in 0..max_steps {
            if self.min_finalized() >= height {
                return Ok(());
            }
            self.step();
        }
        Err(NodeError::Sync(format!(
            "simnet did not reach height {height}; min={}",
            self.min_finalized()
        )))
    }

    pub fn step(&mut self) {
        self.clock += 1;
        self.deliver_ready();
        let ids: Vec<_> = self.order.clone();
        for id in ids {
            let Some(node) = self.nodes.get_mut(&id) else {
                continue;
            };
            if !node.online || node.paused {
                continue;
            }
            node.clock = self.clock;
            let due: Vec<_> = node
                .pending_timeouts
                .iter()
                .filter(|(_, _, _, at)| *at <= self.clock)
                .cloned()
                .collect();
            node.pending_timeouts
                .retain(|(_, _, _, at)| *at > self.clock);
            let mut actions = Vec::new();
            for (kind, height, round, _) in due {
                actions.extend(node.engine.on_timeout(kind, height, round));
            }
            self.dispatch(id, actions);
        }
    }

    fn deliver_ready(&mut self) {
        let mut later = VecDeque::new();
        while let Some(env) = self.inbox.pop_front() {
            if env.deliver_at > self.clock {
                later.push_back(env);
                continue;
            }
            if !self.can_deliver(env.from, env.to) {
                continue;
            }
            let Some(node) = self.nodes.get_mut(&env.to) else {
                continue;
            };
            if !node.online || node.paused {
                continue;
            }
            let actions = node.engine.on_message(env.message);
            self.dispatch(env.to, actions);
        }
        self.inbox.append(&mut later);
    }

    fn dispatch(&mut self, from: ValidatorId, actions: Vec<Action>) {
        for action in actions {
            match action {
                Action::Broadcast(message) => {
                    let targets: Vec<_> = self
                        .order
                        .iter()
                        .copied()
                        .filter(|id| *id != from)
                        .collect();
                    for to in targets {
                        self.enqueue(from, to, message.clone());
                    }
                    // Also deliver locally for votes we already applied.
                }
                Action::NeedProposalBlock { height, .. } => {
                    if let Some(node) = self.nodes.get_mut(&from) {
                        if node.engine.height != height {
                            continue;
                        }
                        let block = node
                            .chain
                            .propose_block(Vec::new(), unix_ms())
                            .expect("propose");
                        let next = node.engine.on_local_block(block);
                        self.dispatch(from, next);
                    }
                }
                Action::Finalize { block, certificate } => {
                    if let Some(node) = self.nodes.get_mut(&from) {
                        if node.chain.height() + 1 == block.header.height {
                            let _ = node.chain.apply_block(block);
                        }
                        let _ = certificate;
                    }
                }
                Action::ScheduleTimeout {
                    kind,
                    height,
                    round,
                    delay,
                } => {
                    if let Some(node) = self.nodes.get_mut(&from) {
                        let ticks = delay_to_ticks(delay);
                        node.pending_timeouts
                            .push((kind, height, round, self.clock + ticks));
                    }
                }
                Action::RequestProposal {
                    height,
                    round,
                    block_id,
                } => {
                    let req = ConsensusMessage::ProposalRequest {
                        height,
                        round,
                        block_id,
                    };
                    for to in self.order.clone() {
                        if to != from {
                            self.enqueue(from, to, req.clone());
                        }
                    }
                }
                Action::RequestCommit { height } => {
                    let req = ConsensusMessage::CommitRequest { height };
                    for to in self.order.clone() {
                        if to != from {
                            self.enqueue(from, to, req.clone());
                        }
                    }
                }
                Action::Evidence(evidence) => self.evidence.push(evidence),
                Action::Reject { reason } => self.rejects.push(reason),
            }
        }
    }

    fn enqueue(&mut self, from: ValidatorId, to: ValidatorId, message: ConsensusMessage) {
        if self.partitions.contains(&(from, to)) || self.drop.contains(&(from, to)) {
            return;
        }
        let delay = *self.delay.get(&(from, to)).unwrap_or(&0);
        // Always defer at least one tick so a single step cannot cascade
        // unbounded heights.
        let deliver_at = self
            .clock
            .saturating_add(1)
            .saturating_add(u64::from(delay));
        self.inbox.push_back(Envelope {
            from,
            to,
            message: message.clone(),
            deliver_at,
        });
        if self.duplicate.contains(&(from, to)) {
            self.inbox.push_back(Envelope {
                from,
                to,
                message,
                deliver_at: deliver_at + 1,
            });
        }
    }

    fn can_deliver(&self, from: ValidatorId, to: ValidatorId) -> bool {
        !self.partitions.contains(&(from, to)) && !self.drop.contains(&(from, to))
    }

    pub fn min_finalized(&self) -> Height {
        self.nodes
            .values()
            .filter(|n| n.online)
            .map(|n| n.engine.finalized_height())
            .min()
            .unwrap_or(0)
    }

    pub fn majority_finalized(&self) -> Height {
        let mut heights: Vec<Height> = self
            .nodes
            .values()
            .filter(|n| n.online)
            .map(|n| n.engine.finalized_height())
            .collect();
        if heights.is_empty() {
            return 0;
        }
        heights.sort_unstable();
        heights[heights.len() / 2]
    }

    pub fn step_until_majority(&mut self, height: Height, max_steps: usize) -> NodeResult<()> {
        for _ in 0..max_steps {
            if self.majority_finalized() >= height {
                return Ok(());
            }
            self.step();
        }
        Err(NodeError::Sync(format!(
            "majority did not reach height {height}; majority={}",
            self.majority_finalized()
        )))
    }

    pub fn heights(&self) -> Vec<(String, Height, [u8; 32])> {
        let mut out: Vec<_> = self
            .nodes
            .values()
            .map(|n| {
                (
                    n.name.clone(),
                    n.engine.finalized_height(),
                    n.engine
                        .store
                        .state_root_at_height(n.engine.finalized_height())
                        .unwrap_or([0u8; 32]),
                )
            })
            .collect();
        out.sort_by(|a, b| a.0.cmp(&b.0));
        out
    }

    pub fn identical_finality(&self, height: Height) -> bool {
        let mut expected: Option<([u8; 32], [u8; 32], Vec<u8>)> = None;
        for node in self.nodes.values() {
            let Some(block) = node.engine.store.finalized_block(height) else {
                return false;
            };
            let Some(cert) = node.engine.store.commit_certificate(height) else {
                return false;
            };
            let encoded = cert.encode().unwrap_or_default();
            match &expected {
                None => expected = Some((block.block_id, block.header.state_root, encoded)),
                Some((id, root, cert_bytes)) => {
                    if *id != block.block_id
                        || *root != block.header.state_root
                        || cert_bytes != &encoded
                    {
                        return false;
                    }
                }
            }
        }
        expected.is_some()
    }

    pub fn by_name(&self, name: &str) -> Option<&SimNode> {
        self.nodes.values().find(|n| n.name == name)
    }

    pub fn by_name_mut(&mut self, name: &str) -> Option<&mut SimNode> {
        self.nodes.values_mut().find(|n| n.name == name)
    }

    fn id_named(&self, name: &str) -> Option<ValidatorId> {
        self.by_name(name).map(|n| n.engine.local_id)
    }

    fn ids_named(&self, names: &[&str]) -> Vec<ValidatorId> {
        names.iter().filter_map(|n| self.id_named(n)).collect()
    }

    pub fn inject(&mut self, to: &str, message: ConsensusMessage) {
        if let Some(node) = self.by_name_mut(to) {
            if node.online && !node.paused {
                let id = node.engine.local_id;
                let actions = node.engine.on_message(message);
                self.dispatch(id, actions);
            }
        }
    }

    pub fn restart(&mut self, name: &str, fixture: &FourValidatorFixture) {
        let Some(existing) = self.by_name(name) else {
            return;
        };
        let id = existing.engine.local_id;
        let wal = existing.engine.wal.clone();
        let signer =
            ConsensusSigner::new(fixture.by_name(name).consensus_key.clone()).expect("signer");
        let mut engine = ConsensusEngine::new(
            fixture.genesis.network_id.clone(),
            fixture.genesis.chain_id.clone(),
            fixture.set.clone(),
            signer,
            wal,
            fixture.params,
        );
        engine.store = existing.engine.store.clone();
        engine.blocks = existing.engine.blocks.clone();
        let chain = existing.chain.clone();
        let mut actions = engine.recover().expect("recover");
        actions.extend(engine.start());
        self.nodes.insert(
            id,
            SimNode {
                name: name.into(),
                engine,
                chain,
                online: true,
                paused: false,
                pending_timeouts: Vec::new(),
                clock: self.clock,
            },
        );
        self.dispatch(id, actions);
    }
}

fn delay_to_ticks(delay: Duration) -> u64 {
    (delay.as_millis() as u64 / 5).max(1)
}

pub fn empty_block(genesis: &Genesis, chain: &DevChain) -> Block {
    chain
        .propose_block(Vec::new(), unix_ms())
        .unwrap_or_else(|_| {
            let other = DevChain::new(genesis.clone());
            other.propose_block(Vec::new(), unix_ms()).expect("block")
        })
}
