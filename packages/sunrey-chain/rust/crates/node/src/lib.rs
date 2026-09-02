//! Local SunRey development node. Not a production BFT engine.

use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use sunrey_crypto::{
    crypto_policy_hash, development_fixture_secret, schema_registry_hash, suite_by_id, CryptoSuite,
    DevEd25519Sha256Suite, SigningSecret, DEV_ALGORITHM_ID, DEV_KEY_ID, DEV_SUITE_ID,
};
use sunrey_execution::{
    apply_transaction, install_genesis_assets, load_assets, store_assets, ExecutionContext,
};
use sunrey_fees::{
    split_fee_intent, usage_for, ChargeInput, ExecutionBudget, FeeAsset, FeeEngine, FeeExemption,
    FeeIntent, ProtocolOp,
};
use sunrey_governance::UpgradeManager;
use sunrey_oracle::OracleEngine;
use sunrey_protocol::{
    block_id, genesis_hash, hash_to_hex, transaction_id, transaction_root,
    unsigned_signature_payload, validate_block_header, BlockHeader, BlockResult, DomainHasher,
    GenesisV1, Hash32, RejectReason, SignatureDescriptor, SignedTransaction, TransactionFamily,
    UnsignedTransaction, BLOCK_VERSION_V1, DOMAIN_VALSET, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
};
use sunrey_state::ChainView;
use sunrey_storage::{ChainStore, FailPoint, StoredBlock};
use tracing::{error, info, warn};

pub const DEV_BLOCK_PRODUCER: &str = "DEV_BLOCK_PRODUCER";
pub const NODE_ROLE: &str = "LOCAL_DEVELOPMENT_SIMULATION";

#[derive(Debug, Default)]
pub struct NodeMetrics {
    pub blocks_committed: AtomicU64,
    pub txs_accepted: AtomicU64,
    pub txs_rejected: AtomicU64,
    pub replays: AtomicU64,
    pub db_errors: AtomicU64,
    pub last_commit_micros: AtomicU64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct NodeStatus {
    pub environment: String,
    pub role: String,
    pub producer: String,
    pub network_id: String,
    pub chain_id: String,
    pub genesis_hash: String,
    pub height: u64,
    pub latest_block_id: String,
    pub app_hash: String,
    pub transaction_root: String,
    pub queue_len: usize,
    pub ready: bool,
    pub protocol_version: u32,
    pub governance: serde_json::Value,
    pub oracle: serde_json::Value,
}

pub struct LocalNode {
    pub store: ChainStore,
    pub suite: DevEd25519Sha256Suite,
    pub genesis_hash: Hash32,
    queue: VecDeque<QueuedTx>,
    pub metrics: NodeMetrics,
    pub governance: UpgradeManager,
    pub oracle: OracleEngine,
    pub fees: FeeEngine,
}

struct QueuedTx {
    tx: SignedTransaction,
    tx_id: Hash32,
}

impl LocalNode {
    pub fn init(data_dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let data_dir = data_dir.as_ref();
        if sunrey_storage::ChainStore::exists(data_dir) {
            return Self::open(data_dir);
        }
        let suite = DevEd25519Sha256Suite;
        let schema_hash = schema_registry_hash(&suite);
        let genesis =
            sunrey_protocol::local_dev_genesis(schema_hash.to_vec(), DEV_SUITE_ID.to_string());
        let mut view = ChainView::default();
        install_genesis_assets(&mut view, &genesis);
        let app_hash = view.store.app_hash(&suite);
        let ghash = genesis_hash(&suite, &genesis);
        info!(
            event = "genesis",
            environment = "simulation",
            role = NODE_ROLE,
            network_id = LOCAL_DEV_NETWORK_ID,
            chain_id = LOCAL_DEV_CHAIN_ID,
            genesis_hash = hash_to_hex(&ghash),
            "initialized local development genesis"
        );
        let mut store = ChainStore::init(data_dir, genesis, ghash, app_hash)?;
        store.view = view;
        store.persist_state_and_meta()?;
        let governance = UpgradeManager::load_or_init(data_dir)?;
        governance.persist(data_dir)?;
        let oracle = OracleEngine::load_or_init(data_dir)?;
        oracle.persist(data_dir)?;
        let fees = load_or_init_fees(data_dir);
        persist_fees(data_dir, &fees)?;
        let node = Self {
            store,
            suite,
            genesis_hash: ghash,
            queue: VecDeque::new(),
            metrics: NodeMetrics::default(),
            governance,
            oracle,
            fees,
        };
        node.persist_queue()?;
        Ok(node)
    }

    pub fn open(data_dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let suite = DevEd25519Sha256Suite;
        let store = ChainStore::open(&data_dir)?;
        let ghash = genesis_hash(&suite, &store.genesis);
        store.validate_canonical_startup(&suite, &ghash)?;
        let assets = load_assets(&store.view)?;
        assets.reconcile_all().map_err(RejectReason::from)?;
        let queue = load_queue(store.data_dir())?;
        let node = Self {
            store,
            suite,
            genesis_hash: ghash,
            queue,
            metrics: NodeMetrics::default(),
            governance: UpgradeManager::load_or_init(&data_dir)?,
            oracle: OracleEngine::load_or_init(&data_dir)?,
            fees: load_or_init_fees(&data_dir),
        };
        node.verify_chain()?;
        info!(
            event = "node_startup",
            environment = "simulation",
            role = NODE_ROLE,
            height = node.store.meta.height,
            genesis_hash = hash_to_hex(&node.genesis_hash),
            app_hash = node.store.meta.app_hash.as_str(),
            "opened local development node"
        );
        Ok(node)
    }

    fn persist_queue(&self) -> Result<(), RejectReason> {
        persist_queue(self.store.data_dir(), &self.queue)
    }

    pub fn set_fail_point(&mut self, point: FailPoint) {
        self.store.fail_point = point;
    }

    pub fn status(&self) -> NodeStatus {
        NodeStatus {
            environment: self.store.genesis.environment.clone(),
            role: NODE_ROLE.to_string(),
            producer: DEV_BLOCK_PRODUCER.to_string(),
            network_id: self.store.genesis.network_id.clone(),
            chain_id: self.store.genesis.chain_id.clone(),
            genesis_hash: hash_to_hex(&self.genesis_hash),
            height: self.store.meta.height,
            latest_block_id: self.store.meta.tip_block_id.clone(),
            app_hash: self.store.meta.app_hash.clone(),
            transaction_root: self.store.meta.transaction_root.clone(),
            queue_len: self.queue.len(),
            ready: true,
            protocol_version: self.governance.protocol_version,
            governance: self.governance.metrics_json(),
            oracle: self.oracle.metrics_json(),
        }
    }

    pub fn submit_bytes(&mut self, bytes: &[u8]) -> Result<String, RejectReason> {
        let tx = SignedTransaction::decode(bytes).map_err(|reason| self.reject(reason))?;
        self.admit(tx)
    }

    pub fn submit_signed(&mut self, tx: SignedTransaction) -> Result<String, RejectReason> {
        self.admit(tx)
    }

    fn admit(&mut self, tx: SignedTransaction) -> Result<String, RejectReason> {
        let tx_id = match self.validate_for_admission(&tx, &self.store.view) {
            Ok(id) => id,
            Err(reason) => return Err(self.reject(reason)),
        };
        if self.queue.len() >= self.store.genesis.queue_bound as usize {
            return Err(self.reject(RejectReason::QueueFull));
        }
        if self.queue.iter().any(|queued| queued.tx_id == tx_id) {
            return Err(self.reject(RejectReason::Replay));
        }
        if let Some(signer) = tx.auth.first().map(|row| row.public_key.as_slice()) {
            if self.queue.iter().any(|queued| {
                queued.tx.auth.first().map(|row| row.public_key.as_slice()) == Some(signer)
                    && queued.tx.unsigned.nonce == tx.unsigned.nonce
            }) {
                return Err(self.reject(RejectReason::Replay));
            }
        }
        let hex = hash_to_hex(&tx_id);
        self.queue.push_back(QueuedTx { tx, tx_id });
        self.persist_queue()?;
        self.metrics.txs_accepted.fetch_add(1, Ordering::Relaxed);
        info!(event = "tx_accepted", tx_id = %hex, "transaction admitted to local queue");
        Ok(hex)
    }

    fn reject(&self, reason: RejectReason) -> RejectReason {
        self.metrics.txs_rejected.fetch_add(1, Ordering::Relaxed);
        if reason == RejectReason::Replay {
            self.metrics.replays.fetch_add(1, Ordering::Relaxed);
        }
        warn!(event = "tx_rejected", reason = reason.as_str(), "transaction rejected");
        reason
    }

    fn validate_for_admission(
        &self,
        tx: &SignedTransaction,
        view: &ChainView,
    ) -> Result<Hash32, RejectReason> {
        let encoded = tx.encode();
        if encoded.len() > self.store.genesis.max_tx_bytes as usize {
            return Err(RejectReason::SizeExceeded);
        }
        let unsigned = &tx.unsigned;
        if unsigned.network_id != self.store.genesis.network_id {
            return Err(RejectReason::WrongNetwork);
        }
        if unsigned.chain_id != self.store.genesis.chain_id {
            return Err(RejectReason::WrongChain);
        }
        if unsigned.codec_id != self.store.genesis.codec_id
            || unsigned.schema_version != self.store.genesis.state_schema_version
        {
            return Err(RejectReason::SchemaInvalid);
        }
        if !self.store.genesis.family_activated(unsigned.family) {
            return Err(RejectReason::TransactionNotActivated);
        }
        self.validate_payload(unsigned)?;
        if tx.auth.is_empty() {
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        let tx_id = transaction_id(&self.suite, unsigned);
        if view.seen_tx_ids.contains(&tx_id) {
            return Err(RejectReason::Replay);
        }
        let message = unsigned_signature_payload(&self.suite, unsigned);
        let mut signer = None;
        for descriptor in &tx.auth {
            self.validate_descriptor(descriptor)?;
            let suite = suite_by_id(&descriptor.suite_id).map_err(RejectReason::from)?;
            suite
                .verify(&descriptor.public_key, &message, &descriptor.signature)
                .map_err(RejectReason::from)?;
            signer = Some(descriptor.public_key.clone());
        }
        let signer = signer.ok_or(RejectReason::InvalidSignatureDescriptor)?;
        let pending = self
            .queue
            .iter()
            .filter(|queued| {
                queued.tx.auth.first().map(|row| row.public_key.as_slice())
                    == Some(signer.as_slice())
            })
            .count() as u64;
        if unsigned.nonce != view.next_nonce(&signer).saturating_add(pending) {
            return Err(RejectReason::Replay);
        }
        if !unsigned.idempotency_key.is_empty()
            && view.store.contains(&sunrey_state::ObjectStore::namespaced(
                sunrey_state::NS_IDEM,
                unsigned.idempotency_key.as_bytes(),
            ))
        {
            return Err(RejectReason::Replay);
        }
        Ok(tx_id)
    }

    fn validate_descriptor(&self, descriptor: &SignatureDescriptor) -> Result<(), RejectReason> {
        if descriptor.suite_id != DEV_SUITE_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        if descriptor.algorithm_id != DEV_ALGORITHM_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        if descriptor.key_id.is_empty()
            || descriptor.public_key.len() != 32
            || descriptor.signature.len() != 64
        {
            return Err(RejectReason::InvalidSignatureDescriptor);
        }
        Ok(())
    }

    fn validate_payload(&self, unsigned: &UnsignedTransaction) -> Result<(), RejectReason> {
        match unsigned.family {
            TransactionFamily::System => {
                let payload = sunrey_protocol::decode_system_payload(&unsigned.payload)?;
                if payload.op != "SET_OBJECT" && payload.op != "NOTE" {
                    return Err(RejectReason::StatelessInvalid);
                }
            }
            TransactionFamily::EvidenceAnchor => {
                let payload = sunrey_protocol::decode_evidence_anchor_payload(&unsigned.payload)?;
                if payload.vault_record_hash.len() != 64 {
                    return Err(RejectReason::StatelessInvalid);
                }
            }
            TransactionFamily::Oracle => {
                if unsigned.payload.is_empty() || unsigned.payload.len() > 4096 {
                    return Err(RejectReason::SizeExceeded);
                }
            }
            TransactionFamily::NativeAsset => {
                if sunrey_native_assets::ExchangeSettlementPayload::looks_like(&unsigned.payload) {
                    sunrey_native_assets::ExchangeSettlementPayload::decode(&unsigned.payload)
                        .map_err(RejectReason::from)?;
                } else {
                    let (payload, rest) =
                        sunrey_native_assets::NativeAssetPayload::decode_prefix(&unsigned.payload)
                            .map_err(RejectReason::from)?;
                    if payload.quantity == 0
                        && payload.op != sunrey_native_assets::NativeAssetOp::Unlock
                    {
                        return Err(RejectReason::StatelessInvalid);
                    }
                    let (fee_intent, rest) = split_fee_intent(rest)?;
                    if !rest.is_empty() {
                        sunrey_native_assets::IssuanceAuthorization::decode(rest)
                            .map_err(RejectReason::from)?;
                    }
                    if let Some(intent) = fee_intent {
                        self.validate_native_fees(
                            &payload,
                            &intent,
                            unsigned.payload.len() + 64,
                            1,
                        )?;
                    }
                }
            }
            TransactionFamily::Identity => return Err(RejectReason::TransactionNotActivated),
        }
        Ok(())
    }

    fn validate_native_fees(
        &self,
        payload: &sunrey_native_assets::NativeAssetPayload,
        intent: &FeeIntent,
        encoded_len: usize,
        sigs: u128,
    ) -> Result<(), RejectReason> {
        if payload.issuance_policy == sunrey_native_assets::DEVELOPMENT_FAUCET_POLICY {
            if self.store.genesis.environment != "simulation" {
                return Err(RejectReason::FaucetForbidden);
            }
            return Ok(());
        }
        if !self.fees.asset_policy.enabled(intent.fee_asset) {
            return Err(RejectReason::UnsupportedFeeAsset);
        }
        let budget = intent.clone().into_budget(FeeExemption::None);
        let mut probe = self.fees.clone();
        probe.validate_admission(
            &budget,
            ProtocolOp::NativeTransfer,
            encoded_len as u128,
            sigs,
            true,
        )
    }

    pub fn produce_block(&mut self) -> Result<BlockResult, RejectReason> {
        if self.store.fail_point == FailPoint::BeforeExecution {
            return Err(RejectReason::InvalidStateTransition);
        }
        let started = Instant::now();
        let mut taken = Vec::new();
        while taken.len() < self.store.genesis.max_block_txs as usize {
            match self.queue.pop_front() {
                Some(item) => taken.push(item),
                None => break,
            }
        }
        let mut next_view = self.store.view.clone();
        let mut included = Vec::new();
        let mut rejected = Vec::new();
        for item in taken {
            if self.store.fail_point == FailPoint::DuringExecution {
                return Err(RejectReason::InvalidStateTransition);
            }
            match self.apply_one(&mut next_view, item.tx) {
                Ok((tx, tx_id)) => included.push((tx, tx_id)),
                Err((tx_id, reason)) => {
                    rejected.push(sunrey_protocol::RejectedTx {
                        tx_id: hash_to_hex(&tx_id),
                        reason: reason.as_str().to_string(),
                    });
                    self.metrics.txs_rejected.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
        let tx_ids: Vec<Hash32> = included.iter().map(|(_, id)| *id).collect();
        let transactions: Vec<SignedTransaction> = included.into_iter().map(|(tx, _)| tx).collect();
        let tx_root = transaction_root(&self.suite, &tx_ids);
        let app_hash = next_view.store.app_hash(&self.suite);
        let height = self.store.meta.height + 1;
        let parent = if height == 1 {
            self.genesis_hash
        } else {
            sunrey_protocol::hash_from_hex(&self.store.meta.tip_block_id)?
        };
        let cap = self.governance.capability();
        let commits = self.governance.activate_at(height, &cap)?;
        self.governance.persist(self.store.data_dir())?;
        self.oracle.height = height;
        self.oracle.now_unix = self.store.genesis.genesis_time_unix_ms / 1000
            + height * self.store.genesis.block_interval_ms / 1000;
        self.oracle.refresh_staleness();
        self.oracle.persist(self.store.data_dir())?;
        let header = BlockHeader {
            version: BLOCK_VERSION_V1,
            network_id: self.store.genesis.network_id.clone(),
            chain_id: self.store.genesis.chain_id.clone(),
            height,
            parent_block_id: parent,
            transaction_root: tx_root,
            app_hash,
            validator_set_hash: self
                .suite
                .hash(DOMAIN_VALSET, self.store.genesis.validator_placeholder.as_bytes()),
            consensus_parameter_hash: commits.consensus_params_hash,
            protocol_version: commits.protocol_version.to_string(),
            module_registry_hash: commits.module_registry_hash,
            codec_registry_hash: commits.codec_registry_hash,
            crypto_policy_hash: commits.crypto_policy_hash,
            timestamp_unix_ms: self.store.genesis.genesis_time_unix_ms
                + height * self.store.genesis.block_interval_ms,
            proposer: DEV_BLOCK_PRODUCER.to_string(),
            crypto_suite_id: DEV_SUITE_ID.to_string(),
        };
        validate_block_header(
            &header,
            &self.store.genesis.network_id,
            &self.store.genesis.chain_id,
            height,
            &parent,
            &tx_root,
            &app_hash,
        )?;
        let bid = block_id(&self.suite, &header);
        info!(
            event = "block_execution",
            height,
            tx_count = transactions.len(),
            producer = DEV_BLOCK_PRODUCER,
            "DEV_BLOCK_PRODUCER constructed local development block"
        );
        self.persist_queue()?;
        match self.store.commit_block(&header, bid, &transactions, &tx_ids, next_view) {
            Ok(()) => {
                persist_fees(self.store.data_dir(), &self.fees)?;
            }
            Err(reason) => {
                self.metrics.db_errors.fetch_add(1, Ordering::Relaxed);
                error!(event = "database_error", reason = reason.as_str(), "block commit failed");
                return Err(reason);
            }
        }
        let micros = started.elapsed().as_micros() as u64;
        self.metrics.last_commit_micros.store(micros, Ordering::Relaxed);
        self.metrics.blocks_committed.fetch_add(1, Ordering::Relaxed);
        info!(
            event = "block_commit",
            height,
            block_id = hash_to_hex(&bid),
            app_hash = hash_to_hex(&app_hash),
            duration_micros = micros,
            "block committed atomically"
        );
        Ok(BlockResult {
            height,
            block_id: hash_to_hex(&bid),
            transaction_root: hash_to_hex(&tx_root),
            app_hash: hash_to_hex(&app_hash),
            tx_ids: tx_ids.iter().map(hash_to_hex).collect(),
            rejected,
        })
    }

    fn apply_one(
        &mut self,
        view: &mut ChainView,
        tx: SignedTransaction,
    ) -> Result<(SignedTransaction, Hash32), (Hash32, RejectReason)> {
        let tx_id = transaction_id(&self.suite, &tx.unsigned);
        if let Err(reason) = self.validate_for_admission(&tx, view) {
            return Err((tx_id, reason));
        }
        let signer = tx.auth[0].public_key.clone();
        if let Err(reason) = view.record_tx_id(tx_id) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = view.record_nonce(&signer, tx.unsigned.nonce) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = view.record_idempotency(&tx.unsigned.idempotency_key) {
            return Err((tx_id, reason));
        }
        if let Err(reason) = self.apply_with_fees(view, &tx, tx_id) {
            return Err((tx_id, reason));
        }
        Ok((tx, tx_id))
    }

    fn apply_with_fees(
        &mut self,
        view: &mut ChainView,
        tx: &SignedTransaction,
        tx_id: Hash32,
    ) -> Result<(), RejectReason> {
        let height = self.store.meta.height + 1;
        let network_id = self.store.genesis.network_id.clone();
        let chain_id = self.store.genesis.chain_id.clone();
        let environment = self.store.genesis.environment.clone();
        let production_network_enabled = self.store.genesis.production_network_enabled;
        let authorization = extract_authorization(tx);
        let exec = ExecutionContext {
            height,
            network_id: &network_id,
            chain_id: &chain_id,
            environment: &environment,
            production_network_enabled,
            authorization,
        };
        let fee_plan = native_fee_plan(tx)?;
        if let Some((payload, budget)) = &fee_plan {
            self.fees.validate_admission(
                budget,
                ProtocolOp::NativeTransfer,
                tx.encode().len() as u128,
                tx.auth.len() as u128,
                true,
            )?;
            self.fees.reserve(budget)?;
            let usage = usage_for(
                ProtocolOp::NativeTransfer,
                tx.encode().len() as u128,
                tx.auth.len() as u128,
            );
            if usage.total() > budget.max_execution_units {
                self.charge_fees(budget, usage, tx_id, "OUT_OF_EXECUTION_UNITS")?;
                self.debit_native_fee(
                    view,
                    budget,
                    self.fees.receipts.get(&hash_to_hex(&tx_id)).map(|r| r.actual_fee).unwrap_or(0),
                )?;
                commit_fee_view(view, &self.fees);
                return Ok(());
            }
            let snapshot = view.clone();
            if let Err(reason) = apply_transaction(view, tx, &exec) {
                *view = snapshot;
                self.fees.release(budget)?;
                return Err(reason);
            }
            self.sync_fee_accounts(payload);
            self.charge_fees(budget, usage, tx_id, "APPLIED")?;
            let actual =
                self.fees.receipts.get(&hash_to_hex(&tx_id)).map(|r| r.actual_fee).unwrap_or(0);
            self.debit_native_fee(view, budget, actual)?;
            commit_fee_view(view, &self.fees);
            return Ok(());
        }
        apply_transaction(view, tx, &exec)?;
        if tx.unsigned.family == TransactionFamily::NativeAsset {
            if let Ok((payload, _)) =
                sunrey_native_assets::NativeAssetPayload::decode_prefix(&tx.unsigned.payload)
            {
                self.sync_fee_accounts(&payload);
            }
        }
        commit_fee_view(view, &self.fees);
        Ok(())
    }

    fn sync_fee_accounts(&mut self, payload: &sunrey_native_assets::NativeAssetPayload) {
        match payload.op {
            sunrey_native_assets::NativeAssetOp::Issue
                if payload.issuance_policy == sunrey_native_assets::DEVELOPMENT_FAUCET_POLICY
                    && payload.asset_id == sunrey_native_assets::NativeAssetId::SunReyCoin =>
            {
                self.fees.faucet(&payload.counterparty, payload.quantity);
            }
            sunrey_native_assets::NativeAssetOp::Transfer
                if payload.asset_id == sunrey_native_assets::NativeAssetId::SunReyCoin =>
            {
                let _ =
                    self.fees.transfer(&payload.actor_id, &payload.counterparty, payload.quantity);
            }
            _ => {}
        }
    }

    fn debit_native_fee(
        &self,
        view: &mut ChainView,
        budget: &ExecutionBudget,
        actual: u128,
    ) -> Result<(), RejectReason> {
        if actual == 0 || !matches!(budget.exemption, FeeExemption::None) {
            return Ok(());
        }
        if budget.fee_asset != FeeAsset::SunreyCoin {
            return Err(RejectReason::UnsupportedFeeAsset);
        }
        let mut ledger = load_assets(view)?;
        ledger
            .debit_available(
                &budget.fee_payer,
                sunrey_native_assets::NativeAssetId::SunReyCoin,
                actual,
            )
            .map_err(RejectReason::from)?;
        store_assets(view, &ledger);
        Ok(())
    }

    fn charge_fees(
        &mut self,
        budget: &ExecutionBudget,
        usage: sunrey_fees::ResourceUsage,
        tx_id: Hash32,
        outcome: &str,
    ) -> Result<(), RejectReason> {
        let hex = hash_to_hex(&tx_id);
        self.fees.charge(ChargeInput {
            budget,
            usage,
            tx_id: &hex,
            height: self.store.meta.height + 1,
            block_id: "pending",
            outcome,
            proposer: DEV_BLOCK_PRODUCER,
            validators: &[(DEV_BLOCK_PRODUCER, 1)],
        })?;
        Ok(())
    }

    pub fn validate_stored_block(&self, stored: &StoredBlock) -> Result<(), RejectReason> {
        let mut tx_ids = Vec::new();
        let mut seen = std::collections::BTreeSet::new();
        for tx in &stored.transactions {
            if tx.unsigned.network_id != self.store.genesis.network_id {
                return Err(RejectReason::WrongNetwork);
            }
            if tx.unsigned.chain_id != self.store.genesis.chain_id {
                return Err(RejectReason::WrongChain);
            }
            let tx_id = transaction_id(&self.suite, &tx.unsigned);
            if !seen.insert(tx_id) {
                return Err(RejectReason::DuplicateTransaction);
            }
            tx_ids.push(tx_id);
        }
        let tx_root = transaction_root(&self.suite, &tx_ids);
        let parent = if stored.header.height == 1 {
            self.genesis_hash
        } else {
            let previous = self.store.load_block(stored.header.height - 1)?;
            block_id(&self.suite, &previous.header)
        };
        validate_block_header(
            &stored.header,
            &self.store.genesis.network_id,
            &self.store.genesis.chain_id,
            stored.header.height,
            &parent,
            &tx_root,
            &stored.header.app_hash,
        )?;
        if stored.header.crypto_suite_id != DEV_SUITE_ID {
            return Err(RejectReason::InvalidCryptoSuite);
        }
        Ok(())
    }

    pub fn sign_dev_tx(
        &self,
        unsigned: UnsignedTransaction,
        secret: &SigningSecret,
    ) -> Result<SignedTransaction, RejectReason> {
        let message = unsigned_signature_payload(&self.suite, &unsigned);
        let signature = self.suite.sign(secret, &message).map_err(RejectReason::from)?;
        Ok(SignedTransaction {
            unsigned,
            auth: vec![SignatureDescriptor {
                suite_id: DEV_SUITE_ID.to_string(),
                algorithm_id: DEV_ALGORITHM_ID.to_string(),
                key_id: DEV_KEY_ID.to_string(),
                public_key: secret.public_key(),
                signature,
            }],
        })
    }

    pub fn fixture_secret() -> SigningSecret {
        development_fixture_secret()
    }

    pub fn queue_contains(&self, tx_id_hex: &str) -> bool {
        self.queue.iter().any(|queued| hash_to_hex(&queued.tx_id) == tx_id_hex)
    }

    pub fn observe_transaction(&self, tx_id_hex: &str) -> sunrey_protocol::TransactionObservation {
        if self.queue_contains(tx_id_hex) {
            return sunrey_protocol::observe(
                tx_id_hex,
                sunrey_protocol::FinalitySource::Mempool,
                None,
            );
        }
        match self.lookup_tx(tx_id_hex) {
            Ok((height, _, _)) => sunrey_protocol::observe(
                tx_id_hex,
                sunrey_protocol::FinalitySource::LocalBlockObservation,
                Some(height),
            ),
            Err(_) => sunrey_protocol::observe(
                tx_id_hex,
                sunrey_protocol::FinalitySource::Rejection,
                None,
            ),
        }
    }

    pub fn prioritize_queue(&mut self) {
        let mut items: Vec<_> = self.queue.drain(..).collect();
        items.sort_by(|left, right| fee_priority(&right.tx).cmp(&fee_priority(&left.tx)));
        self.queue.extend(items);
    }

    pub fn lookup_tx(
        &self,
        tx_id_hex: &str,
    ) -> Result<(u64, SignedTransaction, String), RejectReason> {
        let height = self.store.lookup_tx_height(tx_id_hex)?;
        let block = self.store.load_block(height)?;
        for tx in block.transactions {
            if hash_to_hex(&transaction_id(&self.suite, &tx.unsigned)) == tx_id_hex {
                return Ok((height, tx, hash_to_hex(&block_id(&self.suite, &block.header))));
            }
        }
        Err(RejectReason::NotFound)
    }

    pub fn get_state(&self, key: &str) -> Option<Vec<u8>> {
        let raw = key.as_bytes();
        self.store
            .view
            .store
            .get(raw)
            .map(|v| v.to_vec())
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_OBJECT, raw))
                    .map(|v| v.to_vec())
            })
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_SYSTEM, raw))
                    .map(|v| v.to_vec())
            })
            .or_else(|| {
                self.store
                    .view
                    .store
                    .get(&sunrey_state::ObjectStore::namespaced(sunrey_state::NS_EVIDENCE, raw))
                    .map(|v| v.to_vec())
            })
    }

    pub fn verify_chain(&self) -> Result<(), RejectReason> {
        let mut expected_parent = self.genesis_hash;
        for height in 1..=self.store.meta.height {
            let mut stored = self.store.load_block(height)?;
            stored.block_id = block_id(&self.suite, &stored.header);
            if stored.header.parent_block_id != expected_parent {
                return Err(RejectReason::IncorrectParent);
            }
            self.validate_stored_block(&stored)?;
            expected_parent = stored.block_id;
        }
        Ok(())
    }

    pub fn genesis(&self) -> &GenesisV1 {
        &self.store.genesis
    }

    pub fn crypto_policy_commitment(&self) -> String {
        hash_to_hex(&crypto_policy_hash(&self.suite))
    }

    pub fn native_assets(&self) -> Result<sunrey_native_assets::NativeAssetLedger, RejectReason> {
        load_assets(&self.store.view)
    }

    pub fn fees_schedule_json(&self) -> serde_json::Value {
        serde_json::json!({
            "schedule": self.fees.schedule,
            "hash": self.fees.schedule.hash(),
        })
    }

    pub fn fees_policy_json(&self) -> serde_json::Value {
        self.fees.policy_json()
    }

    pub fn fees_estimate(&self, encoded_bytes: u128, signatures: u128) -> serde_json::Value {
        let usage = usage_for(ProtocolOp::NativeTransfer, encoded_bytes, signatures);
        let fee = self.fees.schedule.calculate(usage).unwrap_or(0);
        serde_json::json!({
            "operation": "NATIVE_TRANSFER",
            "usage": usage,
            "estimated_fee": fee.to_string(),
            "fee_asset": "SUNREY_COIN",
            "minimum_fee": self.fees.schedule.minimum_fee.to_string(),
        })
    }

    pub fn fees_receipt(&self, tx_id: &str) -> Option<serde_json::Value> {
        self.fees
            .receipts
            .get(tx_id)
            .map(|receipt| serde_json::to_value(receipt).unwrap_or_default())
    }

    pub fn fees_resources(&self, tx_id: &str) -> Option<serde_json::Value> {
        self.fees.receipts.get(tx_id).map(|receipt| {
            serde_json::json!({
                "transaction_id": receipt.transaction_id,
                "resource_usage": receipt.resource_usage,
                "outcome": receipt.outcome,
            })
        })
    }

    pub fn fees_rewards(&self, validator: &str) -> serde_json::Value {
        serde_json::json!({
            "validator": validator,
            "accrued": self.fees.rewards.get(validator).copied().unwrap_or(0).to_string(),
            "spendable": self.fees.position(validator, FeeAsset::SunreyCoin).available.to_string(),
            "note": "accrual is not a public staking promise and is not a fiat credit",
        })
    }
}

fn extract_authorization(
    tx: &SignedTransaction,
) -> Option<sunrey_native_assets::IssuanceAuthorization> {
    let (_, rest) =
        sunrey_native_assets::NativeAssetPayload::decode_prefix(&tx.unsigned.payload).ok()?;
    let (_, rest) = split_fee_intent(rest).ok()?;
    if rest.is_empty() {
        return None;
    }
    sunrey_native_assets::IssuanceAuthorization::decode(rest).ok()
}

fn native_fee_plan(
    tx: &SignedTransaction,
) -> Result<Option<(sunrey_native_assets::NativeAssetPayload, ExecutionBudget)>, RejectReason> {
    if tx.unsigned.family != TransactionFamily::NativeAsset {
        return Ok(None);
    }
    let (payload, rest) =
        sunrey_native_assets::NativeAssetPayload::decode_prefix(&tx.unsigned.payload)
            .map_err(RejectReason::from)?;
    let (intent, _) = split_fee_intent(rest)?;
    let Some(intent) = intent else {
        return Ok(None);
    };
    if payload.issuance_policy == sunrey_native_assets::DEVELOPMENT_FAUCET_POLICY {
        return Ok(None);
    }
    Ok(Some((payload, intent.into_budget(FeeExemption::None))))
}

pub fn parent_genesis_hash(node: &LocalNode) -> Hash32 {
    node.genesis_hash
}

fn fee_priority(tx: &SignedTransaction) -> u64 {
    match tx.unsigned.family {
        TransactionFamily::NativeAsset => 2,
        TransactionFamily::System => 1,
        _ => 0,
    }
}

fn persist_queue(dir: &Path, queue: &VecDeque<QueuedTx>) -> Result<(), RejectReason> {
    let mut out = Vec::new();
    sunrey_protocol::encode_u32(&mut out, queue.len() as u32);
    for item in queue {
        sunrey_protocol::encode_bytes(&mut out, &item.tx.encode());
    }
    let path = dir.join("queue.bin");
    let tmp = dir.join("queue.tmp");
    std::fs::write(&tmp, &out).map_err(|_| RejectReason::PersistenceFailure)?;
    std::fs::rename(tmp, path).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

fn load_queue(dir: &Path) -> Result<VecDeque<QueuedTx>, RejectReason> {
    let path = dir.join("queue.bin");
    if !path.exists() {
        return Ok(VecDeque::new());
    }
    let bytes = std::fs::read(path).map_err(|_| RejectReason::CorruptStore)?;
    let mut input = bytes.as_slice();
    let count =
        sunrey_protocol::decode_u32(&mut input).map_err(|_| RejectReason::CorruptStore)? as usize;
    let mut queue = VecDeque::new();
    for _ in 0..count {
        let encoded =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| RejectReason::CorruptStore)?;
        let tx = SignedTransaction::decode(&encoded)?;
        let tx_id = transaction_id(&DevEd25519Sha256Suite, &tx.unsigned);
        queue.push_back(QueuedTx { tx, tx_id });
    }
    Ok(queue)
}

fn load_or_init_fees(dir: impl AsRef<Path>) -> FeeEngine {
    let path = dir.as_ref().join("fees.json");
    if let Ok(bytes) = std::fs::read(&path) {
        if let Ok(engine) = serde_json::from_slice::<FeeEngine>(&bytes) {
            return engine;
        }
    }
    FeeEngine::development()
}

fn persist_fees(dir: impl AsRef<Path>, fees: &FeeEngine) -> Result<(), RejectReason> {
    let path = dir.as_ref().join("fees.json");
    let tmp = dir.as_ref().join("fees.tmp");
    let bytes = serde_json::to_vec(fees).map_err(|_| RejectReason::PersistenceFailure)?;
    std::fs::write(&tmp, bytes).map_err(|_| RejectReason::PersistenceFailure)?;
    std::fs::rename(tmp, path).map_err(|_| RejectReason::PersistenceFailure)?;
    Ok(())
}

fn commit_fee_view(view: &mut ChainView, fees: &FeeEngine) {
    let key = sunrey_state::ObjectStore::namespaced(sunrey_state::NS_FEE, b"commitments");
    let payload = format!(
        "{}:{}:{}",
        fees.schedule.hash(),
        fees.asset_policy.hash(),
        fees.disposition.hash()
    );
    view.store.put(key, payload.into_bytes());
    for (account, position) in &fees.accounts {
        let key = sunrey_state::ObjectStore::namespaced(sunrey_state::NS_FEE, account.as_bytes());
        let value = format!("{}:{}:{}", position.available, position.reserved, position.locked);
        view.store.put(key, value.into_bytes());
    }
}
