//! Rebuild / validate state commitments from stored canonical state.

use sunrey_protocol::{hash_to_hex, DomainHasher, RejectReason};

use crate::ChainStore;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateRootRebuild {
    pub height: u64,
    pub stored_state_root: String,
    pub rebuilt_state_root: String,
    pub matched: bool,
}

pub fn rebuild_state_root(
    store: &ChainStore,
    hasher: &dyn DomainHasher,
) -> Result<StateRootRebuild, RejectReason> {
    let rebuilt = store.view.store.app_hash(hasher);
    let rebuilt_hex = hash_to_hex(&rebuilt);
    Ok(StateRootRebuild {
        height: store.meta.height,
        stored_state_root: store.meta.app_hash.clone(),
        rebuilt_state_root: rebuilt_hex.clone(),
        matched: rebuilt_hex == store.meta.app_hash,
    })
}

pub fn assert_state_root(
    store: &ChainStore,
    hasher: &dyn DomainHasher,
) -> Result<(), RejectReason> {
    let report = rebuild_state_root(store, hasher)?;
    if !report.matched {
        return Err(RejectReason::WrongStateRoot);
    }
    Ok(())
}
