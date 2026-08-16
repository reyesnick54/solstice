//! Append-only consensus WAL. Recovery never rewinds signer or finalized height.

use std::path::{Path, PathBuf};

use crate::codec::{Reader, Writer};
use crate::error::{NodeError, NodeResult};

use super::proposal::SignedProposal;
use super::types::{Height, Round, Step};
use super::vote::{CommitCertificate, SignedVote};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WalRecord {
    NewHeight {
        height: Height,
    },
    NewRound {
        height: Height,
        round: Round,
        step: Step,
    },
    Proposal(SignedProposal),
    Vote(SignedVote),
    Commit(CommitCertificate),
}

impl WalRecord {
    fn kind(&self) -> u8 {
        match self {
            Self::NewHeight { .. } => 1,
            Self::NewRound { .. } => 2,
            Self::Proposal(_) => 3,
            Self::Vote(_) => 4,
            Self::Commit(_) => 5,
        }
    }

    pub fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(self.kind());
        match self {
            Self::NewHeight { height } => w.u64(*height),
            Self::NewRound {
                height,
                round,
                step,
            } => {
                w.u64(*height);
                w.u32(*round);
                w.u8(step.as_u8());
            }
            Self::Proposal(proposal) => w.bytes(&proposal.encode()?)?,
            Self::Vote(vote) => w.bytes(&vote.encode()?)?,
            Self::Commit(cert) => w.bytes(&cert.encode()?)?,
        }
        Ok(w.finish())
    }

    pub fn decode(bytes: &[u8]) -> NodeResult<Self> {
        let mut r = Reader::new(bytes);
        let record = match r.u8()? {
            1 => Self::NewHeight { height: r.u64()? },
            2 => Self::NewRound {
                height: r.u64()?,
                round: r.u32()?,
                step: Step::from_u8(r.u8()?)?,
            },
            3 => Self::Proposal(SignedProposal::decode(&r.bytes()?)?),
            4 => Self::Vote(SignedVote::decode(&r.bytes()?)?),
            5 => Self::Commit(CommitCertificate::decode(&r.bytes()?)?),
            other => return Err(NodeError::Codec(format!("unknown wal record {other}"))),
        };
        r.finish()?;
        Ok(record)
    }
}

#[derive(Debug, Clone)]
pub struct ConsensusWal {
    path: Option<PathBuf>,
    pub records: Vec<WalRecord>,
}

impl ConsensusWal {
    pub fn memory() -> Self {
        Self {
            path: None,
            records: Vec::new(),
        }
    }

    pub fn open(dir: &Path) -> NodeResult<Self> {
        std::fs::create_dir_all(dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let path = dir.join("consensus.wal");
        let mut wal = Self {
            path: Some(path.clone()),
            records: Vec::new(),
        };
        if path.exists() {
            let raw = std::fs::read(&path).map_err(|e| NodeError::Store(e.to_string()))?;
            wal.records = decode_log(&raw)?;
        }
        Ok(wal)
    }

    pub fn append(&mut self, record: WalRecord) -> NodeResult<()> {
        if let Some(path) = &self.path {
            let encoded = record.encode()?;
            let mut out = (encoded.len() as u32).to_be_bytes().to_vec();
            out.extend_from_slice(&encoded);
            use std::io::Write;
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .map_err(|e| NodeError::Store(e.to_string()))?;
            file.write_all(&out)
                .map_err(|e| NodeError::Store(e.to_string()))?;
            file.sync_all()
                .map_err(|e| NodeError::Store(e.to_string()))?;
        }
        self.records.push(record);
        Ok(())
    }
}

fn decode_log(bytes: &[u8]) -> NodeResult<Vec<WalRecord>> {
    let mut pos = 0;
    let mut records = Vec::new();
    while pos + 4 <= bytes.len() {
        let len = u32::from_be_bytes(bytes[pos..pos + 4].try_into().unwrap()) as usize;
        pos += 4;
        if pos + len > bytes.len() {
            return Err(NodeError::Codec("truncated wal".into()));
        }
        records.push(WalRecord::decode(&bytes[pos..pos + len])?);
        pos += len;
    }
    Ok(records)
}
