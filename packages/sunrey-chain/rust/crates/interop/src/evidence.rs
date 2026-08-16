use serde::{Deserialize, Serialize};
use sunrey_protocol::Hash32;

use crate::encoding::domain_hash;
use crate::header::{FinalityProof, ForeignHeader};
use crate::DOMAIN_EVIDENCE;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MisbehaviorEvidence {
    pub client_id: String,
    pub external_chain_id: String,
    pub height: u64,
    pub header_a: ForeignHeader,
    pub proof_a: FinalityProof,
    pub header_b: ForeignHeader,
    pub proof_b: FinalityProof,
}

impl MisbehaviorEvidence {
    pub fn digest(&self) -> Hash32 {
        let mut payload = Vec::new();
        payload.extend_from_slice(&self.header_a.hash());
        payload.extend_from_slice(&self.header_b.hash());
        domain_hash(DOMAIN_EVIDENCE, &payload)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterchainEvidenceRecord {
    pub kind: String,
    pub digest: String,
    pub detail: String,
}
