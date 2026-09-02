//! SunRey application/consensus boundary.
//!
//! `ExecutionConsensusAdapter` wires the Tendermint-class engine to the
//! deterministic state machine (`sunrey-state`, `sunrey-execution`). Consensus
//! finalizes transaction order; the adapter applies that order exactly once.
//! It does not mint, journal, or issue Execution Authority.

use std::collections::VecDeque;

use sunrey_crypto::{
    suite_by_id, CryptoSuite, DevEd25519Sha256Suite, SigningSecret, DEV_ALGORITHM_ID, DEV_SUITE_ID,
};
use sunrey_execution::{apply_transaction, install_genesis_assets, ExecutionContext};
use sunrey_native_assets::IssuanceAuthorization;
use sunrey_protocol::{
    transaction_id, transaction_root, unsigned_signature_payload, GenesisV1, Hash32, RejectReason,
    SignatureDescriptor, SignedTransaction, TransactionFamily, UnsignedTransaction,
};
use sunrey_state::ChainView;

use crate::app::{AppProposal, ProposalContext};
use crate::commit::FinalizedBlock;
use crate::error::ConsensusError;
use crate::message::ProposedValue;

/// Clean boundary between the consensus engine and SunRey's deterministic
/// application state machine.
pub trait ConsensusAdapter {
    fn prepare_proposal(&self, ctx: &ProposalContext) -> Result<AppProposal, ConsensusError>;
    fn validate_proposal(
        &self,
        value: &ProposedValue,
        ctx: &ProposalContext,
    ) -> Result<(), ConsensusError>;
    fn apply_finalized(&mut self, block: &FinalizedBlock) -> Result<Hash32, ConsensusError>;
    fn canonical_height(&self) -> u64;
    fn state_commitment(&self) -> Hash32;
    fn push_mempool(&mut self, tx: SignedTransaction);
}

/// Deterministic execution adapter backed by `ChainView` and `sunrey-execution`.
#[derive(Debug, Clone)]
pub struct ExecutionConsensusAdapter {
    pub genesis: GenesisV1,
    pub view: ChainView,
    pub suite: DevEd25519Sha256Suite,
    height: u64,
    mempool: VecDeque<SignedTransaction>,
}

impl ExecutionConsensusAdapter {
    pub fn development(genesis: GenesisV1) -> Self {
        let mut view = ChainView::default();
        install_genesis_assets(&mut view, &genesis);
        Self { genesis, view, suite: DevEd25519Sha256Suite, height: 0, mempool: VecDeque::new() }
    }

    pub fn from_view(genesis: GenesisV1, view: ChainView, height: u64) -> Self {
        Self { genesis, view, suite: DevEd25519Sha256Suite, height, mempool: VecDeque::new() }
    }

    pub fn sign_dev_tx(
        &self,
        unsigned: UnsignedTransaction,
        secret: &SigningSecret,
    ) -> Result<SignedTransaction, ConsensusError> {
        let message = unsigned_signature_payload(&self.suite, &unsigned);
        let signature =
            self.suite.sign(secret, &message).map_err(|e| ConsensusError::Crypto(e.to_string()))?;
        Ok(SignedTransaction {
            unsigned,
            auth: vec![SignatureDescriptor {
                suite_id: DEV_SUITE_ID.to_string(),
                algorithm_id: DEV_ALGORITHM_ID.to_string(),
                key_id: "consensus-dev".to_string(),
                public_key: secret.public_key(),
                signature,
            }],
        })
    }

    pub fn apply_one(
        genesis: &GenesisV1,
        suite: &DevEd25519Sha256Suite,
        view: &mut ChainView,
        tx: SignedTransaction,
        height: u64,
    ) -> Result<(), ConsensusError> {
        let tx_id = Self::validate_tx_static(genesis, suite, &tx, view)?;
        let signer = tx.auth[0].public_key.clone();
        view.record_tx_id(tx_id).map_err(map_reject)?;
        view.record_nonce(&signer, tx.unsigned.nonce).map_err(map_reject)?;
        view.record_idempotency(&tx.unsigned.idempotency_key).map_err(map_reject)?;
        let embedded = if tx.unsigned.family == TransactionFamily::NativeAsset {
            let (_, rest) =
                sunrey_native_assets::NativeAssetPayload::decode_prefix(&tx.unsigned.payload)
                    .map_err(map_asset)?;
            if rest.is_empty() {
                None
            } else {
                Some(IssuanceAuthorization::decode(rest).map_err(map_asset)?)
            }
        } else {
            None
        };
        let exec = ExecutionContext {
            height,
            network_id: &genesis.network_id,
            chain_id: &genesis.chain_id,
            environment: &genesis.environment,
            production_network_enabled: genesis.production_network_enabled,
            authorization: embedded,
        };
        apply_transaction(view, &tx, &exec).map_err(map_reject)?;
        Ok(())
    }

    pub fn validate_tx(
        &self,
        tx: &SignedTransaction,
        view: &ChainView,
    ) -> Result<Hash32, ConsensusError> {
        Self::validate_tx_static(&self.genesis, &self.suite, tx, view)
    }

    fn validate_tx_static(
        genesis: &GenesisV1,
        suite: &DevEd25519Sha256Suite,
        tx: &SignedTransaction,
        view: &ChainView,
    ) -> Result<Hash32, ConsensusError> {
        let encoded = tx.encode();
        if encoded.len() > genesis.max_tx_bytes as usize {
            return Err(map_reject(RejectReason::SizeExceeded));
        }
        let unsigned = &tx.unsigned;
        if unsigned.network_id != genesis.network_id {
            return Err(ConsensusError::WrongNetwork);
        }
        if unsigned.chain_id != genesis.chain_id {
            return Err(ConsensusError::WrongNetwork);
        }
        if unsigned.codec_id != genesis.codec_id
            || unsigned.schema_version != genesis.state_schema_version
        {
            return Err(map_reject(RejectReason::SchemaInvalid));
        }
        if !genesis.family_activated(unsigned.family) {
            return Err(map_reject(RejectReason::TransactionNotActivated));
        }
        if tx.auth.is_empty() {
            return Err(map_reject(RejectReason::InvalidSignatureDescriptor));
        }
        let tx_id = transaction_id(suite, unsigned);
        if view.seen_tx_ids.contains(&tx_id) {
            return Err(map_reject(RejectReason::Replay));
        }
        let message = unsigned_signature_payload(suite, unsigned);
        let mut signer = None;
        for descriptor in &tx.auth {
            Self::validate_descriptor_static(descriptor)?;
            let suite = suite_by_id(&descriptor.suite_id).map_err(map_crypto)?;
            suite
                .verify(&descriptor.public_key, &message, &descriptor.signature)
                .map_err(map_crypto)?;
            signer = Some(descriptor.public_key.clone());
        }
        let signer = signer.ok_or_else(|| map_reject(RejectReason::InvalidSignatureDescriptor))?;
        if unsigned.nonce != view.next_nonce(&signer) {
            return Err(map_reject(RejectReason::Replay));
        }
        if !unsigned.idempotency_key.is_empty()
            && view.store.contains(&sunrey_state::ObjectStore::namespaced(
                sunrey_state::NS_IDEM,
                unsigned.idempotency_key.as_bytes(),
            ))
        {
            return Err(map_reject(RejectReason::Replay));
        }
        Self::validate_payload_static(genesis, unsigned)?;
        Ok(tx_id)
    }

    fn validate_descriptor_static(descriptor: &SignatureDescriptor) -> Result<(), ConsensusError> {
        if descriptor.suite_id != DEV_SUITE_ID || descriptor.algorithm_id != DEV_ALGORITHM_ID {
            return Err(map_reject(RejectReason::InvalidCryptoSuite));
        }
        if descriptor.public_key.len() != 32 || descriptor.signature.len() != 64 {
            return Err(map_reject(RejectReason::InvalidSignatureDescriptor));
        }
        Ok(())
    }

    fn validate_payload_static(
        _genesis: &GenesisV1,
        unsigned: &UnsignedTransaction,
    ) -> Result<(), ConsensusError> {
        match unsigned.family {
            TransactionFamily::System => {
                let payload = sunrey_protocol::decode_system_payload(&unsigned.payload)
                    .map_err(map_reject)?;
                if payload.op != "SET_OBJECT" && payload.op != "NOTE" {
                    return Err(map_reject(RejectReason::StatelessInvalid));
                }
            }
            TransactionFamily::EvidenceAnchor => {
                let payload = sunrey_protocol::decode_evidence_anchor_payload(&unsigned.payload)
                    .map_err(map_reject)?;
                if payload.vault_record_hash.len() != 64 {
                    return Err(map_reject(RejectReason::StatelessInvalid));
                }
            }
            TransactionFamily::Oracle => {
                if unsigned.payload.is_empty() || unsigned.payload.len() > 4096 {
                    return Err(map_reject(RejectReason::SizeExceeded));
                }
            }
            TransactionFamily::NativeAsset => {
                if sunrey_native_assets::ExchangeSettlementPayload::looks_like(&unsigned.payload) {
                    sunrey_native_assets::ExchangeSettlementPayload::decode(&unsigned.payload)
                        .map_err(map_asset)?;
                } else {
                    let (payload, rest) =
                        sunrey_native_assets::NativeAssetPayload::decode_prefix(&unsigned.payload)
                            .map_err(map_asset)?;
                    if payload.quantity == 0
                        && payload.op != sunrey_native_assets::NativeAssetOp::Unlock
                    {
                        return Err(map_reject(RejectReason::StatelessInvalid));
                    }
                    if payload.op == sunrey_native_assets::NativeAssetOp::Issue
                        && payload.issuance_policy
                            != sunrey_native_assets::DEVELOPMENT_FAUCET_POLICY
                        && rest.is_empty()
                    {
                        return Err(map_reject(RejectReason::UnauthorizedIssuance));
                    }
                }
            }
            TransactionFamily::Identity => {
                return Err(map_reject(RejectReason::TransactionNotActivated));
            }
        }
        Ok(())
    }

    fn simulate_block(
        &self,
        txs: &[SignedTransaction],
        height: u64,
    ) -> Result<ChainView, ConsensusError> {
        let mut scratch = self.view.clone();
        for tx in txs {
            Self::apply_one(&self.genesis, &self.suite, &mut scratch, tx.clone(), height)?;
        }
        Ok(scratch)
    }

    fn decode_block_txs(value: &ProposedValue) -> Result<Vec<SignedTransaction>, ConsensusError> {
        let mut out = Vec::with_capacity(value.transactions.len());
        for raw in &value.transactions {
            out.push(SignedTransaction::decode(raw).map_err(|_| ConsensusError::Decode)?);
        }
        Ok(out)
    }

    fn proposal_from_encoded(
        &self,
        selected: &[Vec<u8>],
        height: u64,
    ) -> Result<AppProposal, ConsensusError> {
        let txs = Self::decode_block_txs(&ProposedValue {
            network_id: self.genesis.network_id.clone(),
            chain_id: self.genesis.chain_id.clone(),
            protocol_version: "1".to_string(),
            height: crate::types::Height::new(height),
            round: crate::types::Round::ZERO,
            parent: [0u8; 32],
            validator_set_hash: [0u8; 32],
            validator_set_version: 0,
            consensus_parameter_hash: [0u8; 32],
            proposer: crate::types::ValidatorId::from("proposer"),
            tx_root: [0u8; 32],
            app_hash_proposal: [0u8; 32],
            transactions: selected.to_vec(),
            time_unix_ms: 0,
        })?;
        let scratch = self.simulate_block(&txs, height)?;
        let tx_ids: Vec<Hash32> =
            txs.iter().map(|tx| transaction_id(&self.suite, &tx.unsigned)).collect();
        Ok(AppProposal {
            transactions: selected.to_vec(),
            tx_root: transaction_root(&self.suite, &tx_ids),
            app_hash_proposal: scratch.store.app_hash(&self.suite),
        })
    }
}

fn map_reject(reason: RejectReason) -> ConsensusError {
    match reason {
        RejectReason::WrongNetwork | RejectReason::WrongChain => ConsensusError::WrongNetwork,
        RejectReason::UnauthorizedIssuance => ConsensusError::ApplicationInvalid,
        _ => ConsensusError::ApplicationInvalid,
    }
}

fn map_crypto(error: sunrey_crypto::CryptoError) -> ConsensusError {
    ConsensusError::Crypto(error.to_string())
}

fn map_asset(_error: sunrey_native_assets::AssetError) -> ConsensusError {
    ConsensusError::ApplicationInvalid
}

impl ConsensusAdapter for ExecutionConsensusAdapter {
    fn prepare_proposal(&self, ctx: &ProposalContext) -> Result<AppProposal, ConsensusError> {
        let mut selected: Vec<Vec<u8>> = Vec::new();
        let mut trial: Vec<SignedTransaction> = Vec::new();
        let mut bytes = 0usize;
        let height = ctx.height.get();
        for tx in &self.mempool {
            let encoded = tx.encode();
            let next = bytes.checked_add(encoded.len()).ok_or(ConsensusError::Overflow)?;
            if next > ctx.max_block_bytes as usize {
                break;
            }
            if selected.len() as u32 >= ctx.max_transactions {
                break;
            }
            if self.validate_tx(tx, &self.view).is_err() {
                continue;
            }
            trial.push(tx.clone());
            if self.simulate_block(&trial, height).is_err() {
                trial.pop();
                continue;
            }
            selected.push(encoded);
            bytes = next;
        }
        self.proposal_from_encoded(&selected, height)
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
        let expected = self.proposal_from_encoded(&value.transactions, ctx.height.get())?;
        if expected.tx_root != value.tx_root {
            return Err(ConsensusError::ProposalRejected("transaction root"));
        }
        if expected.app_hash_proposal != value.app_hash_proposal && !value.transactions.is_empty() {
            return Err(ConsensusError::ProposalRejected("application hash"));
        }
        Ok(())
    }

    fn apply_finalized(&mut self, block: &FinalizedBlock) -> Result<Hash32, ConsensusError> {
        let height = block.height.get();
        if height != self.height + 1 {
            return Err(ConsensusError::InvalidHeight);
        }
        let txs = Self::decode_block_txs(&block.value)?;
        for tx in txs {
            Self::apply_one(&self.genesis, &self.suite, &mut self.view, tx, height)?;
        }
        self.height = height;
        let app_hash = self.view.store.app_hash(&self.suite);
        self.mempool
            .retain(|queued| !block.value.transactions.iter().any(|raw| raw == &queued.encode()));
        Ok(app_hash)
    }

    fn canonical_height(&self) -> u64 {
        self.height
    }

    fn state_commitment(&self) -> Hash32 {
        self.view.store.app_hash(&self.suite)
    }

    fn push_mempool(&mut self, tx: SignedTransaction) {
        self.mempool.push_back(tx);
    }
}

impl crate::app::ConsensusApplication for ExecutionConsensusAdapter {
    fn prepare_proposal(&self, ctx: &ProposalContext) -> Result<AppProposal, ConsensusError> {
        ConsensusAdapter::prepare_proposal(self, ctx)
    }

    fn validate_proposal(
        &self,
        value: &ProposedValue,
        ctx: &ProposalContext,
    ) -> Result<(), ConsensusError> {
        ConsensusAdapter::validate_proposal(self, value, ctx)
    }

    fn apply_finalized(&mut self, block: &FinalizedBlock) -> Result<Hash32, ConsensusError> {
        ConsensusAdapter::apply_finalized(self, block)
    }
}
