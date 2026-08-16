#[cfg(test)]
mod tests {
    use crate::{
        encode_system_payload, hash_to_hex, transaction_id, DomainHasher, SystemPayload,
        TransactionFamily, UnsignedTransaction, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
        SCHEMA_VERSION, SRCB_CODEC_ID,
    };
    use sha2::{Digest, Sha256};

    struct Sha256Suite;
    impl DomainHasher for Sha256Suite {
        fn hash(&self, domain: &str, payload: &[u8]) -> crate::Hash32 {
            Sha256::digest(crate::domain_payload(domain, payload)).into()
        }
    }

    #[test]
    fn known_unsigned_vector_matches_typescript_reference() {
        let payload = encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "alpha".to_string(),
            object_value: b"one".to_vec(),
        });
        let unsigned = UnsignedTransaction {
            network_id: LOCAL_DEV_NETWORK_ID.to_string(),
            chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
            codec_id: SRCB_CODEC_ID.to_string(),
            schema_version: SCHEMA_VERSION,
            family: TransactionFamily::System,
            nonce: 0,
            idempotency_key: "vector-1".to_string(),
            payload,
        };
        assert_eq!(
            hex::encode(unsigned.encode()),
            "0000000a456e76656c6f70655631000000146e65745f73756e7265795f6c6f63616c5f6465760000001463686e5f73756e7265795f6c6f63616c5f64657600000007737263622e7631000000010000000653595354454d000000000000000000000008766563746f722d310000001e0000000a5345545f4f424a45435400000005616c706861000000036f6e65"
        );
        assert_eq!(
            hash_to_hex(&transaction_id(&Sha256Suite, &unsigned)),
            "66a121afafb7f545ae5dddfedd43bc0e17bdc758e919f4e16ac5943811f5b993"
        );
    }
}
