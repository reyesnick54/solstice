//! Versioned sign and verify dispatch through algorithm-agile envelopes.

use crate::algorithm_ids::{AlgorithmWireId, KeyId};
use crate::envelope::{
    HybridCombiner, HybridSignatureEnvelope, HybridVerificationPolicy, PublicKeyEnvelope,
    SignatureEnvelope,
};
use crate::registry::resolve_suite;
use crate::signature_version::SignatureVersion;
use crate::suite::{verify_ed25519, SigningSecret};
use crate::{CryptoError, DEV_SUITE_ID, PROTOCOL_SUITE_ID};

pub fn sign(
    suite_id: &str,
    secret: &SigningSecret,
    message: &[u8],
) -> Result<SignatureEnvelope, CryptoError> {
    let registered = resolve_suite(suite_id)?;
    let suite = registered.as_crypto_suite();
    let signature = suite.sign(secret, message)?;
    Ok(SignatureEnvelope {
        algorithm: suite.algorithm_wire_id(),
        signature_version: SignatureVersion::ClassicalV1,
        suite_id: suite.suite_id().to_string(),
        key_id: KeyId::new(crate::DEV_KEY_ID)?,
        signature,
    })
}

pub fn verify_envelope(
    public_key: &PublicKeyEnvelope,
    message: &[u8],
    envelope: &SignatureEnvelope,
) -> Result<(), CryptoError> {
    if public_key.algorithm != envelope.algorithm {
        return Err(CryptoError::InvalidDescriptor);
    }
    dispatch_verify(
        &envelope.suite_id,
        &public_key.public_key,
        message,
        &envelope.signature,
        envelope.algorithm,
        envelope.signature_version,
    )
}

pub fn verify_hybrid_envelope(
    classical_public_key: &PublicKeyEnvelope,
    pq_public_key: &PublicKeyEnvelope,
    message: &[u8],
    envelope: &HybridSignatureEnvelope,
) -> Result<(), CryptoError> {
    if envelope.combiner != HybridCombiner::ClassicalAndPq {
        return Err(CryptoError::InvalidDescriptor);
    }
    match envelope.verification_policy {
        HybridVerificationPolicy::RequireAll => {
            verify_envelope(classical_public_key, message, &envelope.classical)?;
            verify_envelope(pq_public_key, message, &envelope.post_quantum)
        }
        HybridVerificationPolicy::RequireClassical => {
            verify_envelope(classical_public_key, message, &envelope.classical)
        }
        HybridVerificationPolicy::RequirePq => {
            verify_envelope(pq_public_key, message, &envelope.post_quantum)
        }
        HybridVerificationPolicy::VerifyLegacyOnly => Err(CryptoError::InvalidDescriptor),
    }
}

pub fn dispatch_verify(
    suite_id: &str,
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
    algorithm: AlgorithmWireId,
    signature_version: SignatureVersion,
) -> Result<(), CryptoError> {
    match signature_version {
        SignatureVersion::ClassicalV1 => {
            verify_classical(suite_id, public_key, message, signature, algorithm)
        }
        SignatureVersion::HybridV1 => {
            let hybrid = HybridSignatureEnvelope::deserialize_versioned(signature)?;
            let classical_pk = PublicKeyEnvelope {
                algorithm: hybrid.classical.algorithm,
                signature_version: SignatureVersion::ClassicalV1,
                key_id: hybrid.classical.key_id.clone(),
                public_key: public_key.to_vec(),
            };
            let pq_pk = PublicKeyEnvelope {
                algorithm: hybrid.post_quantum.algorithm,
                signature_version: SignatureVersion::PqNativeV1,
                key_id: hybrid.post_quantum.key_id.clone(),
                public_key: vec![],
            };
            verify_hybrid_envelope(&classical_pk, &pq_pk, message, &hybrid)
        }
        SignatureVersion::PqNativeV1 => {
            verify_pq_native(suite_id, public_key, message, signature, algorithm)
        }
    }
}

fn verify_classical(
    suite_id: &str,
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
    algorithm: AlgorithmWireId,
) -> Result<(), CryptoError> {
    if !algorithm.is_classical_signature() {
        return Err(CryptoError::UnknownAlgorithm);
    }
    match suite_id {
        DEV_SUITE_ID | PROTOCOL_SUITE_ID => verify_ed25519(public_key, message, signature),
        _ => {
            let registered = resolve_suite(suite_id)?;
            registered.as_crypto_suite().verify(public_key, message, signature)
        }
    }
}

fn verify_pq_native(
    suite_id: &str,
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
    algorithm: AlgorithmWireId,
) -> Result<(), CryptoError> {
    let _ = (suite_id, public_key, message, signature);
    if !algorithm.is_pq_signature() {
        return Err(CryptoError::UnknownAlgorithm);
    }
    #[cfg(feature = "experimental-pqc")]
    {
        let _ = algorithm;
        Err(CryptoError::PqNotEnabled)
    }
    #[cfg(not(feature = "experimental-pqc"))]
    {
        let _ = algorithm;
        Err(CryptoError::UnknownSuite)
    }
}

/// Reject downgrade: if policy requires hybrid, classical-only must fail.
pub fn reject_algorithm_downgrade(
    required_hybrid: bool,
    envelope: &SignatureEnvelope,
) -> Result<(), CryptoError> {
    if required_hybrid && envelope.signature_version == SignatureVersion::ClassicalV1 {
        return Err(CryptoError::InvalidDescriptor);
    }
    if envelope.algorithm.is_classical_signature()
        && matches!(envelope.suite_id.as_str(), crate::HYBRID_ED25519_MLDSA_SUITE_ID)
    {
        return Err(CryptoError::InvalidDescriptor);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::development_fixture_secret;
    use crate::suite::DevEd25519Sha256Suite;
    use crate::ML_DSA_65_SUITE_ID;
    use sunrey_protocol::unsigned_signature_payload;

    #[test]
    fn sign_and_verify_round_trip() {
        let secret = development_fixture_secret();
        let suite = DevEd25519Sha256Suite;
        let unsigned = sunrey_protocol::UnsignedTransaction {
            network_id: sunrey_protocol::LOCAL_DEV_NETWORK_ID.to_string(),
            chain_id: sunrey_protocol::LOCAL_DEV_CHAIN_ID.to_string(),
            codec_id: sunrey_protocol::SRCB_CODEC_ID.to_string(),
            schema_version: 1,
            family: sunrey_protocol::TransactionFamily::System,
            nonce: 0,
            idempotency_key: "k1".to_string(),
            payload: vec![1],
        };
        let message = unsigned_signature_payload(&suite, &unsigned);
        let envelope = sign(DEV_SUITE_ID, &secret, &message).unwrap();
        let public_key = PublicKeyEnvelope {
            algorithm: AlgorithmWireId::Ed25519Dev,
            signature_version: SignatureVersion::ClassicalV1,
            key_id: KeyId::new(crate::DEV_KEY_ID).unwrap(),
            public_key: secret.public_key(),
        };
        verify_envelope(&public_key, &message, &envelope).unwrap();
    }

    #[test]
    fn invalid_signature_rejects() {
        let secret = development_fixture_secret();
        let message = b"test-message";
        let mut envelope = sign(DEV_SUITE_ID, &secret, message).unwrap();
        envelope.signature[0] ^= 0xff;
        let public_key = PublicKeyEnvelope {
            algorithm: AlgorithmWireId::Ed25519Dev,
            signature_version: SignatureVersion::ClassicalV1,
            key_id: KeyId::new(crate::DEV_KEY_ID).unwrap(),
            public_key: secret.public_key(),
        };
        assert_eq!(
            verify_envelope(&public_key, message, &envelope),
            Err(CryptoError::InvalidSignature)
        );
    }

    #[test]
    fn downgrade_rejection_blocks_classical_when_hybrid_required() {
        let envelope = SignatureEnvelope {
            algorithm: AlgorithmWireId::Ed25519,
            signature_version: SignatureVersion::ClassicalV1,
            suite_id: PROTOCOL_SUITE_ID.to_string(),
            key_id: KeyId::new("k").unwrap(),
            signature: vec![0; 64],
        };
        assert!(reject_algorithm_downgrade(true, &envelope).is_err());
    }

    #[test]
    fn unsupported_algorithm_rejects_without_ed25519_fallback() {
        assert_eq!(
            dispatch_verify(
                ML_DSA_65_SUITE_ID,
                &[0; 32],
                b"msg",
                &[0; 100],
                AlgorithmWireId::MlDsa65V1,
                SignatureVersion::PqNativeV1,
            ),
            Err(CryptoError::UnknownSuite)
        );
    }
}
