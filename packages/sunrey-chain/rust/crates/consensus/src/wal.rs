use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use sunrey_protocol::{decode_bytes, decode_u32, decode_u64, encode_bytes, encode_u32, encode_u64};

use crate::error::ConsensusError;
use crate::message::{Proposal, Vote};
use crate::signer::SignerSafetyState;
use crate::types::{BlockId, ConsensusStep, Height, Round};
use crate::valset::ValidatorSet;
use crate::CommitCertificate;

const MAGIC: &[u8; 4] = b"SRWL";
const VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WalRecord {
    NewHeight { height: Height },
    NewRound { height: Height, round: Round, step: ConsensusStep },
    Proposal(Proposal),
    Vote(Vote),
    Lock { height: Height, round: Round, block_id: BlockId },
    Valid { height: Height, round: Round, block_id: BlockId },
    Commit(CommitCertificate),
    Signer(SignerSafetyState),
    ValidatorSet(ValidatorSet),
}

impl WalRecord {
    fn kind(&self) -> u8 {
        match self {
            Self::NewHeight { .. } => 1,
            Self::NewRound { .. } => 2,
            Self::Proposal(_) => 3,
            Self::Vote(_) => 4,
            Self::Lock { .. } => 5,
            Self::Valid { .. } => 6,
            Self::Commit(_) => 7,
            Self::Signer(_) => 8,
            Self::ValidatorSet(_) => 9,
        }
    }

    fn payload(&self) -> Vec<u8> {
        match self {
            Self::NewHeight { height } => height.get().to_be_bytes().to_vec(),
            Self::NewRound { height, round, step } => {
                let mut out = Vec::new();
                encode_u64(&mut out, height.get());
                encode_u32(&mut out, round.get());
                out.push(step.rank());
                out
            }
            Self::Proposal(proposal) => proposal.encode(),
            Self::Vote(vote) => vote.encode(),
            Self::Lock { height, round, block_id } | Self::Valid { height, round, block_id } => {
                let mut out = Vec::new();
                encode_u64(&mut out, height.get());
                encode_u32(&mut out, round.get());
                encode_bytes(&mut out, &block_id.0);
                out
            }
            Self::Commit(cert) => cert.encode(),
            Self::Signer(state) => state.encode(),
            Self::ValidatorSet(set) => set.encode(),
        }
    }

    fn decode(kind: u8, payload: &[u8]) -> Result<Self, ConsensusError> {
        match kind {
            1 => {
                if payload.len() != 8 {
                    return Err(ConsensusError::Wal("new-height payload"));
                }
                Ok(Self::NewHeight {
                    height: Height::new(u64::from_be_bytes(
                        payload.try_into().map_err(|_| ConsensusError::Decode)?,
                    )),
                })
            }
            2 => {
                let mut input = payload;
                let height =
                    Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?);
                let round = Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?);
                if input.is_empty() {
                    return Err(ConsensusError::Decode);
                }
                let step = step_from_rank(input[0])?;
                Ok(Self::NewRound { height, round, step })
            }
            3 => Ok(Self::Proposal(Proposal::decode(payload)?)),
            4 => Ok(Self::Vote(Vote::decode(payload)?)),
            5 | 6 => {
                let mut input = payload;
                let height =
                    Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?);
                let round = Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?);
                let bytes = decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?;
                let block_id = BlockId(bytes.try_into().map_err(|_| ConsensusError::Decode)?);
                if kind == 5 {
                    Ok(Self::Lock { height, round, block_id })
                } else {
                    Ok(Self::Valid { height, round, block_id })
                }
            }
            7 => Ok(Self::Commit(CommitCertificate::decode(payload)?)),
            8 => Ok(Self::Signer(SignerSafetyState::decode(payload)?)),
            9 => Ok(Self::ValidatorSet(ValidatorSet::decode(payload)?)),
            _ => Err(ConsensusError::Wal("unknown record")),
        }
    }
}

fn step_from_rank(rank: u8) -> Result<ConsensusStep, ConsensusError> {
    match rank {
        0 => Ok(ConsensusStep::NewHeight),
        1 => Ok(ConsensusStep::Propose),
        2 => Ok(ConsensusStep::Prevote),
        3 => Ok(ConsensusStep::Precommit),
        4 => Ok(ConsensusStep::Commit),
        5 => Ok(ConsensusStep::Finalized),
        _ => Err(ConsensusError::Decode),
    }
}

#[derive(Debug)]
pub struct ConsensusWal {
    path: PathBuf,
    records: Vec<WalRecord>,
}

impl ConsensusWal {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, ConsensusError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|_| ConsensusError::Wal("mkdir"))?;
        }
        let records = if path.exists() { read_all(&path)? } else { Vec::new() };
        if !path.exists() {
            write_header(&path)?;
        }
        Ok(Self { path, records })
    }

    pub fn in_memory() -> Self {
        Self { path: PathBuf::from(""), records: Vec::new() }
    }

    pub fn append(&mut self, record: WalRecord) -> Result<(), ConsensusError> {
        if !self.path.as_os_str().is_empty() {
            append_record(&self.path, &record)?;
        }
        self.records.push(record);
        Ok(())
    }

    pub fn records(&self) -> &[WalRecord] {
        &self.records
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn record_count(&self) -> usize {
        self.records.len()
    }

    pub fn is_persistent(&self) -> bool {
        !self.path.as_os_str().is_empty()
    }
}

fn write_header(path: &Path) -> Result<(), ConsensusError> {
    let mut file = File::create(path).map_err(|_| ConsensusError::Wal("create"))?;
    file.write_all(MAGIC).map_err(|_| ConsensusError::Wal("header"))?;
    file.write_all(&VERSION.to_be_bytes()).map_err(|_| ConsensusError::Wal("header"))?;
    file.sync_all().map_err(|_| ConsensusError::Wal("fsync"))?;
    Ok(())
}

fn append_record(path: &Path, record: &WalRecord) -> Result<(), ConsensusError> {
    let payload = record.payload();
    let mut body = Vec::new();
    body.push(record.kind());
    body.extend_from_slice(&payload);
    let checksum = Sha256::digest(&body);
    let mut file =
        OpenOptions::new().append(true).open(path).map_err(|_| ConsensusError::Wal("open"))?;
    file.write_all(&(body.len() as u32).to_be_bytes()).map_err(|_| ConsensusError::Wal("len"))?;
    file.write_all(&body).map_err(|_| ConsensusError::Wal("body"))?;
    file.write_all(&checksum).map_err(|_| ConsensusError::Wal("checksum"))?;
    file.sync_all().map_err(|_| ConsensusError::Wal("fsync"))?;
    Ok(())
}

fn read_all(path: &Path) -> Result<Vec<WalRecord>, ConsensusError> {
    let mut file = File::open(path).map_err(|_| ConsensusError::Wal("read"))?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|_| ConsensusError::Wal("read"))?;
    if buf.len() < 8 || &buf[..4] != MAGIC {
        return Err(ConsensusError::Wal("magic"));
    }
    let version = u32::from_be_bytes(buf[4..8].try_into().map_err(|_| ConsensusError::Decode)?);
    if version != VERSION {
        return Err(ConsensusError::Wal("version"));
    }
    let mut rest = &buf[8..];
    let mut records = Vec::new();
    while !rest.is_empty() {
        if rest.len() < 4 {
            break;
        }
        let len =
            u32::from_be_bytes(rest[..4].try_into().map_err(|_| ConsensusError::Decode)?) as usize;
        rest = &rest[4..];
        if rest.len() < len.checked_add(32).ok_or(ConsensusError::Overflow)? {
            break;
        }
        let body = &rest[..len];
        let checksum = &rest[len..len + 32];
        rest = &rest[len + 32..];
        if Sha256::digest(body).as_slice() != checksum {
            return Err(ConsensusError::Wal("checksum"));
        }
        if body.is_empty() {
            return Err(ConsensusError::Wal("empty"));
        }
        records.push(WalRecord::decode(body[0], &body[1..])?);
    }
    Ok(records)
}

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct WalStatusView {
    pub path: String,
    pub persistent: bool,
    pub records: usize,
}

impl ConsensusWal {
    pub fn status(&self) -> WalStatusView {
        WalStatusView {
            path: self.path.display().to_string(),
            persistent: self.is_persistent(),
            records: self.record_count(),
        }
    }
}
