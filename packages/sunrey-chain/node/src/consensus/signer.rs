//! Persistent signer safety. Prevents double-signing at the same height/round.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::codec::{Reader, Writer};
use crate::crypto::{DomainKey, KeyDomain};
use crate::error::{NodeError, NodeResult};

use super::types::{BlockId, Height, Round, VoteType};
use super::validators::ValidatorId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SignKind {
    Proposal,
    Prevote,
    Precommit,
}

impl SignKind {
    fn as_u8(self) -> u8 {
        match self {
            Self::Proposal => 1,
            Self::Prevote => 2,
            Self::Precommit => 3,
        }
    }

    fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            1 => Ok(Self::Proposal),
            2 => Ok(Self::Prevote),
            3 => Ok(Self::Precommit),
            _ => Err(NodeError::Codec("unknown sign kind".into())),
        }
    }

    pub fn from_vote(vote: VoteType) -> Self {
        match vote {
            VoteType::Prevote => Self::Prevote,
            VoteType::Precommit => Self::Precommit,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SafetyRecord {
    pub height: Height,
    pub round: Round,
    pub kind: SignKind,
    pub block_id: Option<BlockId>,
}

#[derive(Clone)]
pub struct ConsensusSigner {
    pub validator_id: ValidatorId,
    key: DomainKey,
    last_committed: Height,
    records: BTreeMap<(Height, Round, u8), Option<BlockId>>,
    path: Option<PathBuf>,
}

impl ConsensusSigner {
    pub fn new(key: DomainKey) -> NodeResult<Self> {
        if key.domain != KeyDomain::ValidatorConsensus {
            return Err(NodeError::Forbidden(
                "consensus signer requires ValidatorConsensus key domain".into(),
            ));
        }
        let public = key.public_key();
        Ok(Self {
            validator_id: ValidatorId::from_consensus_key(&public),
            key,
            last_committed: 0,
            records: BTreeMap::new(),
            path: None,
        })
    }

    pub fn from_seed(seed: [u8; 32]) -> NodeResult<Self> {
        Self::new(DomainKey::from_seed(KeyDomain::ValidatorConsensus, seed))
    }

    pub fn public_key(&self) -> [u8; 32] {
        self.key.public_key()
    }

    pub fn last_committed(&self) -> Height {
        self.last_committed
    }

    pub fn open(dir: &Path, key: DomainKey) -> NodeResult<Self> {
        std::fs::create_dir_all(dir).map_err(|e| NodeError::Store(e.to_string()))?;
        let path = dir.join("consensus-signer-safety.bin");
        let mut signer = Self::new(key)?;
        signer.path = Some(path.clone());
        if path.exists() {
            let raw = std::fs::read(&path).map_err(|e| NodeError::Store(e.to_string()))?;
            signer.load(&raw)?;
        } else {
            signer.persist()?;
        }
        Ok(signer)
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.key.sign(message)
    }

    pub fn authorize(
        &mut self,
        height: Height,
        round: Round,
        kind: SignKind,
        block_id: Option<BlockId>,
    ) -> NodeResult<()> {
        if height == 0 {
            return Err(NodeError::Forbidden("cannot sign height 0".into()));
        }
        if height < self.last_committed {
            return Err(NodeError::Forbidden(
                "signer safety refuses a height behind finalized state".into(),
            ));
        }
        let key = (height, round, kind.as_u8());
        if let Some(existing) = self.records.get(&key) {
            if *existing != block_id {
                return Err(NodeError::Forbidden(
                    "signer safety blocked conflicting signature".into(),
                ));
            }
            return Ok(());
        }
        self.records.insert(key, block_id);
        self.persist()?;
        Ok(())
    }

    pub fn mark_committed(&mut self, height: Height) -> NodeResult<()> {
        if height < self.last_committed {
            return Err(NodeError::Forbidden(
                "signer safety cannot move committed height backwards".into(),
            ));
        }
        self.last_committed = height;
        self.records.retain(|(h, _, _), _| *h + 8 >= height);
        self.persist()
    }

    fn persist(&self) -> NodeResult<()> {
        let Some(path) = &self.path else {
            return Ok(());
        };
        std::fs::write(path, self.encode()?).map_err(|e| NodeError::Store(e.to_string()))
    }

    fn encode(&self) -> NodeResult<Vec<u8>> {
        let mut w = Writer::new();
        w.u8(1);
        w.u64(self.last_committed);
        w.u32(self.records.len() as u32);
        for ((height, round, kind), block_id) in &self.records {
            w.u64(*height);
            w.u32(*round);
            w.u8(*kind);
            match block_id {
                None => w.u8(0),
                Some(id) => {
                    w.u8(1);
                    w.bytes32(id);
                }
            }
        }
        Ok(w.finish())
    }

    fn load(&mut self, bytes: &[u8]) -> NodeResult<()> {
        let mut r = Reader::new(bytes);
        if r.u8()? != 1 {
            return Err(NodeError::Codec("unknown signer-safety schema".into()));
        }
        self.last_committed = r.u64()?;
        let count = r.u32()? as usize;
        self.records.clear();
        for _ in 0..count {
            let height = r.u64()?;
            let round = r.u32()?;
            let kind = SignKind::from_u8(r.u8()?)?;
            let block_id = match r.u8()? {
                0 => None,
                1 => Some(r.bytes32()?),
                _ => return Err(NodeError::Codec("invalid signer record".into())),
            };
            self.records.insert((height, round, kind.as_u8()), block_id);
        }
        r.finish()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_conflicting_prevote_and_survives_restart() {
        let dir = std::env::temp_dir().join(format!(
            "sunrey-signer-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let seed = [7u8; 32];
        let key = DomainKey::from_seed(KeyDomain::ValidatorConsensus, seed);
        let mut signer = ConsensusSigner::open(&dir, key.clone()).unwrap();
        signer
            .authorize(1, 0, SignKind::Prevote, Some([1u8; 32]))
            .unwrap();
        assert!(signer
            .authorize(1, 0, SignKind::Prevote, Some([2u8; 32]))
            .is_err());
        signer.mark_committed(1).unwrap();
        assert!(signer
            .authorize(1, 0, SignKind::Precommit, Some([1u8; 32]))
            .is_ok());
        assert!(signer.authorize(0, 0, SignKind::Proposal, None).is_err());
        drop(signer);
        let mut restarted = ConsensusSigner::open(&dir, key).unwrap();
        assert_eq!(restarted.last_committed(), 1);
        assert!(restarted
            .authorize(1, 0, SignKind::Prevote, Some([2u8; 32]))
            .is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}
