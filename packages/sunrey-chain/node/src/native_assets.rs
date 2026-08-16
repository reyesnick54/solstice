//! Native asset execution on the development P2P node.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};

use sunrey_native_assets::{
    apply_native_asset, ApplyContext, AssetCrypto, AssetError, CryptoClass, CryptoPolicy,
    IssuanceAuthorization, NativeAssetLedger, NativeAssetPayload,
};

use crate::chain::{Genesis, Transaction, DEV_CHAIN_ID, DEV_NETWORK_ID};
use crate::crypto::{CRYPTO_SUITE_ID, SIG_ALG_ID};
use crate::error::{NodeError, NodeResult};

pub struct NodeAssetCrypto;

impl AssetCrypto for NodeAssetCrypto {
    fn suite_id(&self) -> &str {
        CRYPTO_SUITE_ID
    }

    fn algorithm_id(&self) -> &str {
        SIG_ALG_ID
    }

    fn crypto_class(&self) -> CryptoClass {
        CryptoClass::Classical
    }

    fn verify(
        &self,
        public_key: &[u8],
        message: &[u8],
        signature: &[u8],
    ) -> Result<(), AssetError> {
        let pk: [u8; 32] = public_key
            .try_into()
            .map_err(|_| AssetError::InvalidCryptoSuite)?;
        let sig: [u8; 64] = signature
            .try_into()
            .map_err(|_| AssetError::InvalidSignature)?;
        let verifying =
            VerifyingKey::from_bytes(&pk).map_err(|_| AssetError::InvalidCryptoSuite)?;
        verifying
            .verify(message, &Signature::from_bytes(&sig))
            .map_err(|_| AssetError::InvalidSignature)
    }
}

pub fn development_policy() -> CryptoPolicy {
    CryptoPolicy::development_classical(CRYPTO_SUITE_ID, SIG_ALG_ID)
}

pub fn sign_authorization(auth: &mut IssuanceAuthorization, seed: &[u8; 32]) {
    let key = SigningKey::from_bytes(seed);
    auth.suite_id = CRYPTO_SUITE_ID.to_string();
    auth.algorithm_id = SIG_ALG_ID.to_string();
    auth.public_key = key.verifying_key().to_bytes().to_vec();
    auth.signature = key.sign(&auth.unsigned_bytes()).to_bytes().to_vec();
}

pub fn apply_payload(
    ledger: &mut NativeAssetLedger,
    tx: &Transaction,
    height: u64,
    genesis: &Genesis,
) -> NodeResult<()> {
    if !NativeAssetPayload::looks_like(&tx.payload) {
        return Ok(());
    }
    let (payload, rest) = NativeAssetPayload::decode_prefix(&tx.payload)
        .map_err(|e| NodeError::Validation(e.to_string()))?;
    let embedded = if rest.is_empty() {
        None
    } else {
        Some(
            IssuanceAuthorization::decode(rest)
                .map_err(|e| NodeError::Validation(e.to_string()))?,
        )
    };
    let crypto = NodeAssetCrypto;
    let policy = development_policy();
    let environment = if genesis.network_id == DEV_NETWORK_ID && genesis.chain_id == DEV_CHAIN_ID {
        "development"
    } else {
        "unknown"
    };
    let ctx = ApplyContext {
        height,
        network_id: &genesis.network_id,
        chain_id: &genesis.chain_id,
        environment,
        production_network_enabled: false,
        protocol_version: u32::from(genesis.protocol_version),
        crypto: &crypto,
        crypto_policy: &policy,
        authorization: embedded.as_ref(),
    };
    apply_native_asset(ledger, &payload, &ctx).map_err(|e| NodeError::Validation(e.to_string()))
}

pub fn encode_with_auth(payload: &NativeAssetPayload, auth: &IssuanceAuthorization) -> Vec<u8> {
    let mut out = payload.encode();
    out.extend_from_slice(&auth.encode());
    out
}
