use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sunrey_protocol::{decode_bytes, decode_u32, decode_u64, encode_bytes, encode_u32, encode_u64};

use crate::error::ConsensusError;
use crate::types::{BlockId, ConsensusStep, Height, Round};

/// Tendermint FilePV-class last-sign-state. Persist before signing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignerSafetyState {
    pub height: Height,
    pub round: Round,
    pub step: ConsensusStep,
    pub block_id: BlockId,
}

impl SignerSafetyState {
    pub fn genesis() -> Self {
        Self {
            height: Height::GENESIS,
            round: Round::ZERO,
            step: ConsensusStep::NewHeight,
            block_id: BlockId::NIL,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_u64(&mut out, self.height.get());
        encode_u32(&mut out, self.round.get());
        out.push(self.step.rank());
        encode_bytes(&mut out, &self.block_id.0);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ConsensusError> {
        let mut input = bytes;
        let height = Height::new(decode_u64(&mut input).map_err(|_| ConsensusError::Decode)?);
        let round = Round::new(decode_u32(&mut input).map_err(|_| ConsensusError::Decode)?);
        if input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        let step = match input[0] {
            0 => ConsensusStep::NewHeight,
            1 => ConsensusStep::Propose,
            2 => ConsensusStep::Prevote,
            3 => ConsensusStep::Precommit,
            4 => ConsensusStep::Commit,
            5 => ConsensusStep::Finalized,
            _ => return Err(ConsensusError::Decode),
        };
        input = &input[1..];
        let block_bytes = decode_bytes(&mut input).map_err(|_| ConsensusError::Decode)?;
        let block_id = BlockId(block_bytes.try_into().map_err(|_| ConsensusError::Decode)?);
        if !input.is_empty() {
            return Err(ConsensusError::Decode);
        }
        Ok(Self { height, round, step, block_id })
    }
}

#[derive(Debug)]
pub struct SignerSafetyStore {
    path: PathBuf,
    pub state: SignerSafetyState,
}

impl SignerSafetyStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, ConsensusError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|_| ConsensusError::Wal("signer safety mkdir"))?;
        }
        let state = if path.exists() {
            let bytes = fs::read(&path).map_err(|_| ConsensusError::Wal("signer safety read"))?;
            SignerSafetyState::decode(&bytes)?
        } else {
            let state = SignerSafetyState::genesis();
            atomic_write(&path, &state.encode())?;
            state
        };
        Ok(Self { path, state })
    }

    pub fn in_memory() -> Self {
        Self { path: PathBuf::from(""), state: SignerSafetyState::genesis() }
    }

    /// Refuse a conflicting (height, round, step, block_id). Same value may be re-signed.
    pub fn authorize(
        &mut self,
        height: Height,
        round: Round,
        step: ConsensusStep,
        block_id: BlockId,
    ) -> Result<(), ConsensusError> {
        if height < self.state.height {
            return Err(ConsensusError::SignerSafetyConflict);
        }
        if height == self.state.height {
            if round < self.state.round {
                return Err(ConsensusError::SignerSafetyConflict);
            }
            if round == self.state.round {
                if step.rank() < self.state.step.rank() {
                    return Err(ConsensusError::SignerSafetyConflict);
                }
                if step == self.state.step && self.state.block_id != block_id {
                    return Err(ConsensusError::SignerSafetyConflict);
                }
            }
        }
        self.state = SignerSafetyState { height, round, step, block_id };
        if !self.path.as_os_str().is_empty() {
            atomic_write(&self.path, &self.state.encode())?;
        }
        Ok(())
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), ConsensusError> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|_| ConsensusError::Wal("signer safety write"))?;
    fs::rename(&tmp, path).map_err(|_| ConsensusError::Wal("signer safety rename"))?;
    Ok(())
}
