use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use sunrey_crypto::{algorithm_id_for_suite, suite_by_id, CryptoSuite, SigningSecret};
use sunrey_protocol::{domain_payload, encode_string, encode_u64};

use crate::lifecycle::{assert_consensus_purpose, assert_controller};
use crate::types::{
    err, ConsensusMessageType, ConsensusSignRequest, EquivocationEvidence, SignerSafetyState,
    ValidatorError, NIL_BLOCK_ID, PROTOCOL_SUITE_ID,
};

pub fn encode_sign_bytes(request: &ConsensusSignRequest) -> Vec<u8> {
    let mut payload = Vec::new();
    encode_string(&mut payload, request.message_type.domain());
    encode_string(&mut payload, &request.network_id);
    encode_string(&mut payload, &request.chain_id);
    encode_string(&mut payload, &request.protocol_version);
    encode_string(&mut payload, request.message_type.as_str());
    encode_u64(&mut payload, request.height);
    encode_u64(&mut payload, request.round);
    encode_string(&mut payload, &request.block_id);
    encode_string(&mut payload, &request.validator_id);
    encode_u64(&mut payload, request.validator_set_version);
    encode_string(&mut payload, &request.crypto_suite_id);
    payload
}

pub fn sign_bytes_hash(request: &ConsensusSignRequest) -> String {
    hex::encode(Sha256::digest(domain_payload(
        request.message_type.domain(),
        &encode_sign_bytes(request),
    )))
}

pub trait ConsensusSigner {
    fn kind(&self) -> &'static str;
    fn sign(&self, request: &ConsensusSignRequest) -> Result<String, ValidatorError>;
}

pub struct LocalDevelopmentSigner {
    secret: SigningSecret,
}

impl LocalDevelopmentSigner {
    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self { secret: SigningSecret::from_bytes(seed) }
    }
}

impl ConsensusSigner for LocalDevelopmentSigner {
    fn kind(&self) -> &'static str {
        "LOCAL_DEVELOPMENT_SIGNER"
    }

    fn sign(&self, request: &ConsensusSignRequest) -> Result<String, ValidatorError> {
        if request.crypto_suite_id != PROTOCOL_SUITE_ID {
            return Err(err(
                "SIGNER_PROVIDER_UNAVAILABLE",
                "unknown crypto suite; no silent fallback",
            ));
        }
        let _ = algorithm_id_for_suite(&request.crypto_suite_id)
            .map_err(|_| err("SIGNER_PROVIDER_UNAVAILABLE", "unregistered suite"))?;
        let suite = suite_by_id(&request.crypto_suite_id)
            .map_err(|_| err("SIGNER_PROVIDER_UNAVAILABLE", "unregistered suite"))?;
        let signature = suite
            .sign(&self.secret, &encode_sign_bytes(request))
            .map_err(|_| err("SIGNER_PROVIDER_UNAVAILABLE", "suite sign failed"))?;
        Ok(hex::encode(signature))
    }
}

pub fn unavailable_signer(kind: &'static str) -> Result<String, ValidatorError> {
    Err(err(
        "SIGNER_PROVIDER_UNAVAILABLE",
        format!("{kind} is reserved; only LOCAL_DEVELOPMENT_SIGNER is implemented"),
    ))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), ValidatorError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
    }
    let tmp = path.with_extension("tmp");
    {
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp)
            .map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        file.write_all(bytes).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        file.sync_all().map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
    }
    fs::rename(&tmp, path).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
    if let Some(parent) = path.parent() {
        if let Ok(dir) = File::open(parent) {
            let _ = dir.sync_all();
        }
    }
    Ok(())
}

pub struct DurableSignerSafety {
    path: PathBuf,
    conflict_rejected: u64,
}

impl DurableSignerSafety {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into(), conflict_rejected: 0 }
    }

    pub fn load(&self) -> Result<Option<SignerSafetyState>, ValidatorError> {
        if !self.path.exists() {
            return Ok(None);
        }
        let mut file =
            File::open(&self.path).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        let state = serde_json::from_slice(&bytes)
            .map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        Ok(Some(state))
    }

    pub fn persist(&self, state: &SignerSafetyState) -> Result<(), ValidatorError> {
        let bytes =
            serde_json::to_vec(state).map_err(|error| err("SIGNER_CONFLICT", error.to_string()))?;
        atomic_write(&self.path, &bytes)
    }

    pub fn protect(
        &mut self,
        request: &ConsensusSignRequest,
        signer: &dyn ConsensusSigner,
        controller_kind: &str,
        now_utc: &str,
    ) -> Result<(String, SignerSafetyState), ValidatorError> {
        assert_controller(controller_kind)?;
        assert_consensus_purpose("VALIDATOR_CONSENSUS_SIGNING")?;
        let next_hash = sign_bytes_hash(request);
        if let Some(existing) = self.load()? {
            if conflicts(&existing, request, &next_hash) {
                self.conflict_rejected += 1;
                return Err(err(
                    "SIGNER_CONFLICT",
                    format!(
                        "conflicting {} at height {} round {}",
                        request.message_type.as_str(),
                        request.height,
                        request.round
                    ),
                ));
            }
            if existing.canonical_sign_bytes_hash == next_hash
                && !existing.signature_reference.is_empty()
            {
                return Ok((existing.signature_reference.clone(), existing));
            }
        }
        let reserved = SignerSafetyState {
            validator_id: request.validator_id.clone(),
            chain_id: request.chain_id.clone(),
            last_signed_height: request.height,
            last_signed_round: request.round,
            last_signed_step: request.message_type,
            canonical_sign_bytes_hash: next_hash,
            signature_reference: String::new(),
            updated_at: now_utc.to_string(),
        };
        self.persist(&reserved)?;
        let signature = signer.sign(request)?;
        let committed = SignerSafetyState { signature_reference: signature.clone(), ..reserved };
        self.persist(&committed)?;
        Ok((signature, committed))
    }

    pub fn conflict_rejected(&self) -> u64 {
        self.conflict_rejected
    }
}

fn conflicts(
    existing: &SignerSafetyState,
    request: &ConsensusSignRequest,
    next_hash: &str,
) -> bool {
    if existing.chain_id != request.chain_id {
        return false;
    }
    if existing.last_signed_height != request.height || existing.last_signed_round != request.round
    {
        return false;
    }
    if existing.last_signed_step != request.message_type {
        return false;
    }
    if existing.canonical_sign_bytes_hash == next_hash {
        return false;
    }
    true
}

pub fn safety_path(data_dir: impl AsRef<Path>, validator_id: &str, chain_id: &str) -> PathBuf {
    let digest = hex::encode(Sha256::digest(format!("{validator_id}:{chain_id}").as_bytes()));
    data_dir.as_ref().join("signer-safety").join(format!("{}.json", &digest[..16]))
}

pub fn evidence(
    kind: &str,
    request_a: &ConsensusSignRequest,
    request_b: &ConsensusSignRequest,
    signature_a: &str,
    signature_b: &str,
    public_key_hex: &str,
) -> EquivocationEvidence {
    EquivocationEvidence {
        kind: kind.to_string(),
        validator_id: request_a.validator_id.clone(),
        validator_set_version: request_a.validator_set_version,
        height: request_a.height,
        round: request_a.round,
        message_type: request_a.message_type.as_str().to_string(),
        message_a_hash: sign_bytes_hash(request_a),
        message_b_hash: sign_bytes_hash(request_b),
        signature_a_hex: signature_a.to_string(),
        signature_b_hex: signature_b.to_string(),
        public_key_hex: public_key_hex.to_string(),
        crypto_suite_id: request_a.crypto_suite_id.clone(),
        network_id: request_a.network_id.clone(),
        chain_id: request_a.chain_id.clone(),
    }
}

pub fn sign_proposal(
    signer: &dyn ConsensusSigner,
    safety: &mut DurableSignerSafety,
    request: ConsensusSignRequest,
    controller_kind: &str,
    now_utc: &str,
) -> Result<String, ValidatorError> {
    assert_eq_type(request.message_type, ConsensusMessageType::Proposal)?;
    Ok(safety.protect(&request, signer, controller_kind, now_utc)?.0)
}

pub fn sign_prevote(
    signer: &dyn ConsensusSigner,
    safety: &mut DurableSignerSafety,
    request: ConsensusSignRequest,
    controller_kind: &str,
    now_utc: &str,
) -> Result<String, ValidatorError> {
    assert_eq_type(request.message_type, ConsensusMessageType::Prevote)?;
    Ok(safety.protect(&request, signer, controller_kind, now_utc)?.0)
}

pub fn sign_precommit(
    signer: &dyn ConsensusSigner,
    safety: &mut DurableSignerSafety,
    request: ConsensusSignRequest,
    controller_kind: &str,
    now_utc: &str,
) -> Result<String, ValidatorError> {
    assert_eq_type(request.message_type, ConsensusMessageType::Precommit)?;
    Ok(safety.protect(&request, signer, controller_kind, now_utc)?.0)
}

fn assert_eq_type(
    actual: ConsensusMessageType,
    expected: ConsensusMessageType,
) -> Result<(), ValidatorError> {
    if actual != expected {
        return Err(err("UNDEFINED_TRANSITION", "consensus message type mismatch"));
    }
    let _ = NIL_BLOCK_ID;
    Ok(())
}
