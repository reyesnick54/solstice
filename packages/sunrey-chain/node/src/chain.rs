//! Local deterministic development chain.
//!
//! Sequential apply, recomputed roots, isolated file store. Not a second
//! financial ledger. Does not mint native assets or post journals.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::accountability::{AccountabilityState, ValidatorAccountabilityPolicy};
use crate::codec::{Reader, Writer};
use crate::crypto::{sha256, verify, DomainKey, KeyDomain};
use crate::error::{NodeError, NodeResult};
use crate::evidence::{
    evidence_root, verify_equivocation_evidence, EquivocationEvidence, EvidenceContext,
};
use crate::identity::unix_ms;
use crate::validators::{ValidatorRuntime, ValidatorSet};

pub const DEV_NETWORK_ID: &str = "net_sunrey_development";
pub const DEV_CHAIN_ID: &str = "chn_sunrey_development";
pub const MAX_TX_BYTES: usize = 16_384;
pub const MAX_BLOCK_TXS: usize = 128;
pub const MAX_BLOCK_BYTES: usize = 512_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Genesis {
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: u16,
    pub codec_version: u16,
    pub crypto_suite: String,
    pub created_at_ms: u64,
    pub validator_set_hash: [u8; 32],
    pub validator_set: ValidatorSet,
    pub hash: [u8; 32],
}

impl Genesis {
    pub fn development() -> Self {
        let mut genesis = Self {
            network_id: DEV_NETWORK_ID.into(),
            chain_id: DEV_CHAIN_ID.into(),
            protocol_version: crate::crypto::PROTOCOL_VERSION,
            codec_version: crate::crypto::CODEC_VERSION,
            crypto_suite: crate::crypto::CRYPTO_SUITE_ID.into(),
            created_at_ms: 1,
            validator_set_hash: [0u8; 32],
            validator_set: ValidatorSet::empty(),
            hash: [0u8; 32],
        };
        genesis.hash = genesis.compute_hash();
        genesis
    }

    pub fn with_validator_set(mut self, set: ValidatorSet) -> Self {
        self.validator_set_hash = set.hash();
        self.validator_set = set;
        self.hash = self.compute_hash();
        self
    }

    pub fn compute_hash(&self) -> [u8; 32] {
        let mut w = Writer::new();
        w.string(&self.network_id).expect("genesis network id");
        w.string(&self.chain_id).expect("genesis chain id");
        w.u16(self.protocol_version);
        w.u16(self.codec_version);
        w.string(&self.crypto_suite).expect("genesis suite");
        w.u64(self.created_at_ms);
        w.bytes32(&self.validator_set_hash);
        sha256(&w.finish())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transaction {
    pub network_id: String,
    pub chain_id: String,
    pub actor_id: String,
    pub nonce: u64,
    pub payload: Vec<u8>,
    pub expires_at_ms: u64,
    pub crypto_suite: String,
    pub public_key: [u8; 32],
    pub signature: [u8; 64],
}

impl Transaction {
    pub fn unsigned_bytes(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.string(&self.actor_id)?;
        w.u64(self.nonce);
        w.bytes(&self.payload)?;
        w.u64(self.expires_at_ms);
        w.string(&self.crypto_suite)?;
        w.bytes32(&self.public_key);
        Ok(w.finish())
    }

    pub fn id(&self) -> [u8; 32] {
        sha256(&self.encode().unwrap_or_default())
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.string(&self.actor_id)?;
        w.u64(self.nonce);
        w.bytes(&self.payload)?;
        w.u64(self.expires_at_ms);
        w.string(&self.crypto_suite)?;
        w.bytes32(&self.public_key);
        w.bytes64(&self.signature);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown tx schema".into()));
        }
        let tx = Self {
            network_id: r.string()?,
            chain_id: r.string()?,
            actor_id: r.string()?,
            nonce: r.u64()?,
            payload: r.bytes()?,
            expires_at_ms: r.u64()?,
            crypto_suite: r.string()?,
            public_key: r.bytes32()?,
            signature: r.bytes64()?,
        };
        r.finish()?;
        Ok(tx)
    }

    pub fn sign(
        wallet: &DomainKey,
        network_id: &str,
        chain_id: &str,
        actor_id: &str,
        nonce: u64,
        payload: Vec<u8>,
        expires_at_ms: u64,
    ) -> NodeResult<Self> {
        if wallet.domain != KeyDomain::TxWallet {
            return Err(NodeError::Forbidden(
                "transaction must be signed by a wallet key".into(),
            ));
        }
        let mut tx = Self {
            network_id: network_id.into(),
            chain_id: chain_id.into(),
            actor_id: actor_id.into(),
            nonce,
            payload,
            expires_at_ms,
            crypto_suite: crate::crypto::CRYPTO_SUITE_ID.into(),
            public_key: wallet.public_key(),
            signature: [0u8; 64],
        };
        let unsigned = tx.unsigned_bytes()?;
        tx.signature = wallet.sign(&unsigned);
        Ok(tx)
    }

    pub fn encoded_len(&self) -> usize {
        self.encode().map(|b| b.len()).unwrap_or(0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockHeader {
    pub network_id: String,
    pub chain_id: String,
    pub height: u64,
    pub parent_id: [u8; 32],
    pub tx_root: [u8; 32],
    pub state_root: [u8; 32],
    pub evidence_root: [u8; 32],
    pub validator_set_hash: [u8; 32],
    pub epoch: u64,
    pub protocol_version: u16,
    pub crypto_suite: String,
    pub time_ms: u64,
    /// Schema-1 headers omit accountability fields on the wire.
    pub legacy_wire: bool,
}

impl BlockHeader {
    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.string(&self.network_id)?;
        w.string(&self.chain_id)?;
        w.u64(self.height);
        w.bytes32(&self.parent_id);
        w.bytes32(&self.tx_root);
        w.bytes32(&self.state_root);
        if !self.legacy_wire {
            w.bytes32(&self.evidence_root);
            w.bytes32(&self.validator_set_hash);
            w.u64(self.epoch);
        }
        w.u16(self.protocol_version);
        w.string(&self.crypto_suite)?;
        w.u64(self.time_ms);
        Ok(w.finish())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub header: BlockHeader,
    pub transactions: Vec<Transaction>,
    pub evidence: Vec<EquivocationEvidence>,
    pub block_id: [u8; 32],
}

impl Block {
    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(2);
        w.bytes(&self.header.encode()?)?;
        w.u32(self.transactions.len() as u32);
        for tx in &self.transactions {
            w.bytes(&tx.encode()?)?;
        }
        w.u32(self.evidence.len() as u32);
        for item in &self.evidence {
            w.bytes(&item.encode()?)?;
        }
        w.bytes32(&self.block_id);
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let schema = r.u8()?;
        if schema != 1 && schema != 2 {
            return Err(NodeError::Codec("unknown block schema".into()));
        }
        let header = decode_header(&r.bytes()?)?;
        let count = r.u32()? as usize;
        if count > MAX_BLOCK_TXS {
            return Err(NodeError::Codec("too many transactions".into()));
        }
        let mut transactions = Vec::with_capacity(count);
        for _ in 0..count {
            transactions.push(Transaction::decode(&r.bytes()?)?);
        }
        let mut evidence = Vec::new();
        if schema == 2 {
            let ev_count = r.u32()? as usize;
            if ev_count > crate::evidence::MAX_EVIDENCE_PER_BLOCK {
                return Err(NodeError::Codec("too much evidence".into()));
            }
            for _ in 0..ev_count {
                evidence.push(EquivocationEvidence::decode(&r.bytes()?)?);
            }
        }
        let block_id = r.bytes32()?;
        r.finish()?;
        Ok(Self {
            header,
            transactions,
            evidence,
            block_id,
        })
    }
}

fn decode_header(bytes: &[u8]) -> NodeResult<BlockHeader> {
    decode_header_v2(bytes).or_else(|_| decode_header_v1(bytes))
}

fn decode_header_v2(bytes: &[u8]) -> NodeResult<BlockHeader> {
    let mut r = Reader::new(bytes);
    let network_id = r.string()?;
    let chain_id = r.string()?;
    let height = r.u64()?;
    let parent_id = r.bytes32()?;
    let tx_root = r.bytes32()?;
    let state_root = r.bytes32()?;
    let evidence_root = r.bytes32()?;
    let validator_set_hash = r.bytes32()?;
    let epoch = r.u64()?;
    let header = BlockHeader {
        network_id,
        chain_id,
        height,
        parent_id,
        tx_root,
        state_root,
        evidence_root,
        validator_set_hash,
        epoch,
        protocol_version: r.u16()?,
        crypto_suite: r.string()?,
        time_ms: r.u64()?,
        legacy_wire: false,
    };
    r.finish()?;
    Ok(header)
}

fn decode_header_v1(bytes: &[u8]) -> NodeResult<BlockHeader> {
    let mut r = Reader::new(bytes);
    let header = BlockHeader {
        network_id: r.string()?,
        chain_id: r.string()?,
        height: r.u64()?,
        parent_id: r.bytes32()?,
        tx_root: r.bytes32()?,
        state_root: r.bytes32()?,
        evidence_root: [0u8; 32],
        validator_set_hash: [0u8; 32],
        epoch: 0,
        protocol_version: r.u16()?,
        crypto_suite: r.string()?,
        time_ms: r.u64()?,
        legacy_wire: true,
    };
    r.finish()?;
    Ok(header)
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ActorState {
    pub nonce: u64,
    pub data_root: [u8; 32],
}

#[derive(Debug, Clone)]
pub struct DevChain {
    pub genesis: Genesis,
    pub state: BTreeMap<String, ActorState>,
    pub blocks: Vec<Block>,
    pub validators: ValidatorRuntime,
    pub accountability: AccountabilityState,
    data_dir: Option<PathBuf>,
}

impl DevChain {
    pub fn new(genesis: Genesis) -> Self {
        let validators = ValidatorRuntime::new(
            genesis.validator_set.clone(),
            crate::validators::DEFAULT_EPOCH_LENGTH,
        );
        Self {
            genesis,
            state: BTreeMap::new(),
            blocks: Vec::new(),
            validators,
            accountability: AccountabilityState::new(ValidatorAccountabilityPolicy::development()),
            data_dir: None,
        }
    }

    pub fn open(dir: &Path, genesis: Genesis) -> NodeResult<Self> {
        std::fs::create_dir_all(dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let validators = ValidatorRuntime::new(
            genesis.validator_set.clone(),
            crate::validators::DEFAULT_EPOCH_LENGTH,
        );
        let mut chain = Self {
            genesis,
            state: BTreeMap::new(),
            blocks: Vec::new(),
            validators,
            accountability: AccountabilityState::new(ValidatorAccountabilityPolicy::development())
                .with_persist_dir(dir),
            data_dir: Some(dir.to_path_buf()),
        };
        let blocks_dir = dir.join("blocks");
        if blocks_dir.exists() {
            let mut files: Vec<_> = std::fs::read_dir(&blocks_dir)
                .map_err(|e| NodeError::Store(e.to_string()))?
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .collect();
            files.sort();
            for path in files {
                let raw = std::fs::read(&path).map_err(|e| NodeError::Store(e.to_string()))?;
                let block = Block::decode(&raw)?;
                chain.apply_validated(block)?;
            }
        }
        Ok(chain)
    }

    pub fn height(&self) -> u64 {
        self.blocks.len() as u64
    }

    pub fn tip_id(&self) -> [u8; 32] {
        self.blocks
            .last()
            .map(|b| b.block_id)
            .unwrap_or(self.genesis.hash)
    }

    pub fn state_root(&self) -> [u8; 32] {
        compute_state_root(&self.state)
    }

    pub fn block_by_height(&self, height: u64) -> Option<&Block> {
        if height == 0 {
            return None;
        }
        self.blocks.get((height - 1) as usize)
    }

    pub fn block_by_id(&self, id: &[u8; 32]) -> Option<&Block> {
        self.blocks.iter().find(|b| &b.block_id == id)
    }

    pub fn validate_tx_stateless(&self, tx: &Transaction, now_ms: u64) -> NodeResult<()> {
        if tx.network_id != self.genesis.network_id {
            return Err(NodeError::Validation("tx network mismatch".into()));
        }
        if tx.chain_id != self.genesis.chain_id {
            return Err(NodeError::Validation("tx chain mismatch".into()));
        }
        if tx.crypto_suite != self.genesis.crypto_suite {
            return Err(NodeError::Validation("tx crypto suite mismatch".into()));
        }
        if tx.payload.len() > MAX_TX_BYTES {
            return Err(NodeError::Validation("tx exceeds max size".into()));
        }
        if tx.actor_id.is_empty() {
            return Err(NodeError::Validation("tx actor required".into()));
        }
        if tx.expires_at_ms != 0 && now_ms > tx.expires_at_ms {
            return Err(NodeError::Validation("tx expired".into()));
        }
        let unsigned = tx.unsigned_bytes()?;
        verify(
            KeyDomain::TxWallet,
            &tx.public_key,
            &unsigned,
            &tx.signature,
        )
    }

    pub fn validate_tx_stateful(&self, tx: &Transaction) -> NodeResult<()> {
        let current = self.state.get(&tx.actor_id).map(|s| s.nonce).unwrap_or(0);
        if tx.nonce != current + 1 {
            return Err(NodeError::Validation("tx nonce replay or gap".into()));
        }
        Ok(())
    }

    pub fn apply_tx(&mut self, tx: &Transaction) -> NodeResult<()> {
        self.validate_tx_stateful(tx)?;
        let entry = self.state.entry(tx.actor_id.clone()).or_default();
        entry.nonce = tx.nonce;
        let mut acc = Vec::from(entry.data_root);
        acc.extend_from_slice(&tx.payload);
        entry.data_root = sha256(&acc);
        Ok(())
    }

    pub fn propose_block(&self, txs: Vec<Transaction>, time_ms: u64) -> NodeResult<Block> {
        self.propose_block_with_evidence(txs, Vec::new(), time_ms)
    }

    pub fn propose_block_with_evidence(
        &self,
        txs: Vec<Transaction>,
        evidence: Vec<EquivocationEvidence>,
        time_ms: u64,
    ) -> NodeResult<Block> {
        let mut working = self.clone_state();
        let mut accepted = Vec::new();
        let mut bytes = 0usize;
        for tx in txs {
            if accepted.len() >= MAX_BLOCK_TXS {
                break;
            }
            let encoded = tx.encode()?;
            if bytes + encoded.len() > MAX_BLOCK_BYTES {
                break;
            }
            if apply_to_state(&mut working, &tx).is_ok() {
                bytes += encoded.len();
                accepted.push(tx);
            }
        }
        let mut accepted_evidence = Vec::new();
        for item in evidence {
            if accepted_evidence.len() >= crate::evidence::MAX_EVIDENCE_PER_BLOCK {
                break;
            }
            let historical = self.validators.set_at_height(item.offense_height());
            let ctx = EvidenceContext {
                network_id: &self.genesis.network_id,
                chain_id: &self.genesis.chain_id,
                current_height: self.height() + 1,
                historical_set: historical,
                processed: &self.accountability.processed,
            };
            if verify_equivocation_evidence(&item, &ctx).is_ok() {
                accepted_evidence.push(item);
            }
        }
        let height = self.height() + 1;
        let header = BlockHeader {
            network_id: self.genesis.network_id.clone(),
            chain_id: self.genesis.chain_id.clone(),
            height,
            parent_id: self.tip_id(),
            tx_root: tx_root(&accepted),
            state_root: compute_state_root(&working),
            evidence_root: evidence_root(&accepted_evidence),
            validator_set_hash: self.validators.active.hash(),
            epoch: self.validators.epoch_of(height),
            protocol_version: self.genesis.protocol_version,
            crypto_suite: self.genesis.crypto_suite.clone(),
            time_ms,
            legacy_wire: false,
        };
        let block_id = sha256(&header.encode()?);
        Ok(Block {
            header,
            transactions: accepted,
            evidence: accepted_evidence,
            block_id,
        })
    }

    pub fn validate_block(&self, block: &Block) -> NodeResult<()> {
        if block.header.network_id != self.genesis.network_id {
            return Err(NodeError::Validation("block network mismatch".into()));
        }
        if block.header.chain_id != self.genesis.chain_id {
            return Err(NodeError::Validation("block chain mismatch".into()));
        }
        if block.header.protocol_version != self.genesis.protocol_version {
            return Err(NodeError::Validation("block protocol mismatch".into()));
        }
        if block.header.crypto_suite != self.genesis.crypto_suite {
            return Err(NodeError::Validation("block crypto suite mismatch".into()));
        }
        if block.header.height != self.height() + 1 {
            return Err(NodeError::Validation("block height mismatch".into()));
        }
        if block.header.parent_id != self.tip_id() {
            return Err(NodeError::Validation("block parent mismatch".into()));
        }
        if tx_root(&block.transactions) != block.header.tx_root {
            return Err(NodeError::Validation("tx root mismatch".into()));
        }
        let expected_id = sha256(&block.header.encode()?);
        if expected_id != block.block_id {
            return Err(NodeError::Validation("block id mismatch".into()));
        }
        let now = unix_ms();
        let mut working = self.clone_state();
        for tx in &block.transactions {
            self.validate_tx_stateless(tx, now)?;
            apply_to_state(&mut working, tx)?;
        }
        if compute_state_root(&working) != block.header.state_root {
            return Err(NodeError::Validation("state root mismatch".into()));
        }
        if evidence_root(&block.evidence) != block.header.evidence_root {
            return Err(NodeError::Validation("evidence root mismatch".into()));
        }
        if block.header.validator_set_hash != self.validators.active.hash() {
            return Err(NodeError::Validation(
                "validator-set hash must match the active epoch set".into(),
            ));
        }
        if block.header.epoch != self.validators.epoch_of(block.header.height) {
            return Err(NodeError::Validation("block epoch mismatch".into()));
        }
        if block.evidence.len() > crate::evidence::MAX_EVIDENCE_PER_BLOCK {
            return Err(NodeError::Validation("too much evidence".into()));
        }
        for item in &block.evidence {
            let historical = self.validators.set_at_height(item.offense_height());
            let ctx = EvidenceContext {
                network_id: &self.genesis.network_id,
                chain_id: &self.genesis.chain_id,
                current_height: block.header.height,
                historical_set: historical,
                processed: &self.accountability.processed,
            };
            verify_equivocation_evidence(item, &ctx)?;
        }
        Ok(())
    }

    pub fn apply_block(&mut self, block: Block) -> NodeResult<[u8; 32]> {
        self.validate_block(&block)?;
        self.apply_validated(block)
    }

    fn apply_validated(&mut self, block: Block) -> NodeResult<[u8; 32]> {
        let prior_protocol = self.genesis.protocol_version;
        let prior_active_hash = self.validators.active.hash();
        let prior_history_len = self.validators.history.len();
        for tx in &block.transactions {
            self.apply_tx(tx)?;
        }
        if self.state_root() != block.header.state_root {
            return Err(NodeError::Validation("local state root diverged".into()));
        }
        for item in &block.evidence {
            self.accountability.execute(
                item,
                &mut self.validators,
                &self.genesis.network_id,
                &self.genesis.chain_id,
                block.header.height,
                block.block_id,
            )?;
        }
        self.validators.commit_epoch_if_needed(block.header.height);
        if self.genesis.protocol_version != prior_protocol {
            return Err(NodeError::Validation(
                "evidence must not change protocol version".into(),
            ));
        }
        if !self.validators.is_epoch_end(block.header.height)
            && self.validators.active.hash() != prior_active_hash
        {
            return Err(NodeError::Validation(
                "validator-set hash must not change mid-epoch".into(),
            ));
        }
        if self.validators.history.len() < prior_history_len {
            return Err(NodeError::Validation(
                "validator history is append-only".into(),
            ));
        }
        if let Some(dir) = &self.data_dir {
            let blocks_dir = dir.join("blocks");
            std::fs::create_dir_all(&blocks_dir).map_err(|e| NodeError::Store(e.to_string()))?;
            let path = blocks_dir.join(format!("{:08}.bin", block.header.height));
            std::fs::write(path, block.encode()?).map_err(|e| NodeError::Store(e.to_string()))?;
        }
        let root = block.header.state_root;
        self.blocks.push(block);
        Ok(root)
    }

    fn clone_state(&self) -> BTreeMap<String, ActorState> {
        self.state.clone()
    }
}

fn apply_to_state(state: &mut BTreeMap<String, ActorState>, tx: &Transaction) -> NodeResult<()> {
    let current = state.get(&tx.actor_id).map(|s| s.nonce).unwrap_or(0);
    if tx.nonce != current + 1 {
        return Err(NodeError::Validation("tx nonce replay or gap".into()));
    }
    let entry = state.entry(tx.actor_id.clone()).or_default();
    entry.nonce = tx.nonce;
    let mut acc = Vec::from(entry.data_root);
    acc.extend_from_slice(&tx.payload);
    entry.data_root = sha256(&acc);
    Ok(())
}

pub fn compute_state_root(state: &BTreeMap<String, ActorState>) -> [u8; 32] {
    let mut w = Writer::new();
    w.u32(state.len() as u32);
    for (actor, actor_state) in state {
        w.string(actor).expect("actor id");
        w.u64(actor_state.nonce);
        w.bytes32(&actor_state.data_root);
    }
    sha256(&w.finish())
}

pub fn tx_root(txs: &[Transaction]) -> [u8; 32] {
    let mut w = Writer::new();
    w.u32(txs.len() as u32);
    for tx in txs {
        w.bytes32(&tx.id());
    }
    sha256(&w.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_signed_tx_and_recompute_root() {
        let mut chain = DevChain::new(Genesis::development());
        let wallet = DomainKey::generate(KeyDomain::TxWallet);
        let tx = Transaction::sign(
            &wallet,
            &chain.genesis.network_id,
            &chain.genesis.chain_id,
            "actor-a",
            1,
            b"record".to_vec(),
            0,
        )
        .unwrap();
        chain.validate_tx_stateless(&tx, unix_ms()).unwrap();
        let block = chain.propose_block(vec![tx], 10).unwrap();
        let root = chain.apply_block(block).unwrap();
        assert_eq!(chain.height(), 1);
        assert_eq!(chain.state_root(), root);
    }
}
