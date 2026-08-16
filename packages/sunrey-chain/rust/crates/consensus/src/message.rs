use serde::{Deserialize, Serialize};
use sunrey_crypto::CryptoSuite;
use sunrey_protocol::{
    decode_bytes, decode_string, decode_u32, decode_u64, encode_bytes, encode_string, encode_u32,
    encode_u64, DomainHasher, Hash32,
};

use crate::error::ConsensusError;
use crate::types::{BlockId, Height, ProposalId, Round, ValidatorId, VoteType};

pub const DOMAIN_PROPOSAL: &str = "SUNREY_CONSENSUS_PROPOSAL_V1";
pub const DOMAIN_PREVOTE: &str = "SUNREY_CONSENSUS_PREVOTE_V1";
pub const DOMAIN_PRECOMMIT: &str = "SUNREY_CONSENSUS_PRECOMMIT_V1";
pub const DOMAIN_COMMIT: &str = "SUNREY_CONSENSUS_COMMIT_V1";
pub const PROTOCOL_VERSION: &str = "1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProposedValue {
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: String,
    pub height: Height,
    pub round: Round,
    pub parent: Hash32,
    pub validator_set_hash: Hash32,
    pub validator_set_version: u64,
    pub consensus_parameter_hash: Hash32,
    pub proposer: ValidatorId,
    pub tx_root: Hash32,
    pub app_hash_proposal: Hash32,
    pub transactions: Vec<Vec<u8>>,
    pub time_unix_ms: u64,
}

impl ProposedValue {
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, "ProposedValueV1");
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_string(&mut out, &self.protocol_version);
        encode_u64(&mut out, self.height.get());
        encode_u32(&mut out, self.round.get());
        encode_bytes(&mut out, &self.parent);
        encode_bytes(&mut out, &self.validator_set_hash);
        encode_u64(&mut out, self.validator_set_version);
        encode_bytes(&mut out, &self.consensus_parameter_hash);
        encode_string(&mut out, self.proposer.as_str());
        encode_bytes(&mut out, &self.tx_root);
        encode_bytes(&mut out, &self.app_hash_proposal);
        encode_u32(&mut out, self.transactions.len() as u32);
        for tx in &self.transactions {
            encode_bytes(&mut out, tx);
        }
        encode_u64(&mut out, self.time_unix_ms);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| ConsensusError::Decode)?;
        if tag != "ProposedValueV1" {
            return Err(ConsensusError::Decode);
        }
        let value = Self {
            network_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            chain_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            protocol_version: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            height: Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?),
            round: Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?),
            parent: decode_hash(&mut input)?,
            validator_set_hash: decode_hash(&mut input)?,
            validator_set_version: decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?,
            consensus_parameter_hash: decode_hash(&mut input)?,
            proposer: ValidatorId(decode_string(&mut input).map_err(|_| ConsensusError::Decode)?),
            tx_root: decode_hash(&mut input)?,
            app_hash_proposal: decode_hash(&mut input)?,
            transactions: decode_tx_list(&mut input)?,
            time_unix_ms: decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?,
        };
        if !input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        Ok(value)
    }

    pub fn encoded_len(&self) -> usize {
        self.encode().len()
    }

    pub fn block_id(&self, hasher: &dyn DomainHasher) -> BlockId {
        BlockId(hasher.hash(DOMAIN_PROPOSAL, &self.encode()))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Proposal {
    pub value: ProposedValue,
    pub pol_round: Option<Round>,
    pub signature: Vec<u8>,
}

impl Proposal {
    pub fn proposal_id(&self, hasher: &dyn DomainHasher) -> ProposalId {
        ProposalId(hasher.hash(DOMAIN_PROPOSAL, &self.encode_unsigned()))
    }

    pub fn encode_unsigned(&self) -> Vec<u8> {
        let mut out = self.value.encode();
        encode_u32(&mut out, self.pol_round.map(Round::get).unwrap_or(u32::MAX));
        out
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.encode_unsigned();
        encode_bytes(&mut out, &self.signature);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        decode_proposal(bytes)
    }
}

fn decode_proposal(bytes: &[u8]) -> Result<Proposal, ConsensusError> {
    let mut input = bytes;
    let tag = decode_string(&mut input).map_err(|_| ConsensusError::Decode)?;
    if tag != "ProposedValueV1" {
        return Err(ConsensusError::Decode);
    }
    let value = ProposedValue {
        network_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
        chain_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
        protocol_version: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
        height: Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?),
        round: Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?),
        parent: decode_hash(&mut input)?,
        validator_set_hash: decode_hash(&mut input)?,
        validator_set_version: decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?,
        consensus_parameter_hash: decode_hash(&mut input)?,
        proposer: ValidatorId(decode_string(&mut input).map_err(|_| ConsensusError::Decode)?),
        tx_root: decode_hash(&mut input)?,
        app_hash_proposal: decode_hash(&mut input)?,
        transactions: decode_tx_list(&mut input)?,
        time_unix_ms: decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?,
    };
    let pol_raw = decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?;
    let pol_round = if pol_raw == u32::MAX { None } else { Some(Round::new(pol_raw)) };
    let signature = decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?;
    if !input.is_empty() {
        return Err(ConsensusError::Decode);
    }
    Ok(Proposal { value, pol_round, signature })
}

impl Proposal {
    pub fn decode_signed(bytes: &[u8]) -> Result<Self, ConsensusError> {
        decode_proposal(bytes)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Vote {
    pub vote_type: VoteType,
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: String,
    pub height: Height,
    pub round: Round,
    pub block_id: BlockId,
    pub validator_id: ValidatorId,
    pub validator_set_version: u64,
    pub signature: Vec<u8>,
}

impl Vote {
    pub fn encode_unsigned(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, "VoteV1");
        out.push(self.vote_type.to_u8());
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        encode_string(&mut out, &self.protocol_version);
        encode_u64(&mut out, self.height.get());
        encode_u32(&mut out, self.round.get());
        encode_bytes(&mut out, &self.block_id.0);
        encode_string(&mut out, self.validator_id.as_str());
        encode_u64(&mut out, self.validator_set_version);
        out
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.encode_unsigned();
        encode_bytes(&mut out, &self.signature);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| ConsensusError::Decode)?;
        if tag != "VoteV1" {
            return Err(ConsensusError::Decode);
        }
        if input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        let vote_type = VoteType::from_u8(input[0])?;
        input = &input[1..];
        let vote = Self {
            vote_type,
            network_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            chain_id: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            protocol_version: decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            height: Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?),
            round: Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?),
            block_id: BlockId(decode_hash(&mut input)?),
            validator_id: ValidatorId(
                decode_string(&mut input).map_err(|_| ConsensusError::Decode)?,
            ),
            validator_set_version: decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?,
            signature: decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?,
        };
        if !input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        Ok(vote)
    }

    pub fn domain(self_type: VoteType) -> &'static str {
        match self_type {
            VoteType::Prevote => DOMAIN_PREVOTE,
            VoteType::Precommit => DOMAIN_PRECOMMIT,
        }
    }
}

pub fn sign_domain_message<S: CryptoSuite>(
    suite: &S,
    secret: &sunrey_crypto::SigningSecret,
    domain: &str,
    unsigned: &[u8],
) -> Result<Vec<u8>, ConsensusError> {
    let digest = suite.hash(domain, unsigned);
    Ok(suite.sign(secret, &digest)?)
}

pub fn verify_domain_message<S: CryptoSuite>(
    suite: &S,
    public_key: &[u8],
    domain: &str,
    unsigned: &[u8],
    signature: &[u8],
) -> Result<(), ConsensusError> {
    let digest = suite.hash(domain, unsigned);
    suite.verify(public_key, &digest, signature).map_err(Into::into)
}

fn decode_hash(input: &mut &[u8]) -> Result<Hash32, ConsensusError> {
    let bytes = decode_bytes(input).map_err(|_| ConsensusError::Decode)?;
    bytes.try_into().map_err(|_| ConsensusError::Decode)
}

fn decode_tx_list(input: &mut &[u8]) -> Result<Vec<Vec<u8>>, ConsensusError> {
    let count = decode_u32(input).map_err(|_| ConsensusError::Decode)? as usize;
    let mut txs = Vec::with_capacity(count);
    for _ in 0..count {
        txs.push(decode_bytes(input).map_err(|_| ConsensusError::Decode)?);
    }
    Ok(txs)
}
