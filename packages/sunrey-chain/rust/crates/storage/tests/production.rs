use std::time::{SystemTime, UNIX_EPOCH};

use sunrey_crypto::DevEd25519Sha256Suite;
use sunrey_protocol::{
    hash_to_hex, BlockHeader, Hash32, RejectReason, LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID,
};
use sunrey_state::ChainView;
use sunrey_storage::{
    assert_state_root, create_production_snapshot, fingerprint, fingerprints_equal,
    migrate_file_store_to_production, mutate_snapshot_chunk, rebuild_state_root,
    restore_production_snapshot, verify_production_snapshot, ChainStore, DurabilityPolicy,
    FailPoint, NodeRetentionMode, SchemaCompatibility, SchemaRecord, WalDomain,
    PRODUCTION_ENGINE_NAME, PRODUCTION_SCHEMA_VERSION,
};

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-storage-{label}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn genesis_store(dir: &std::path::Path, file: bool) -> ChainStore {
    let genesis = sunrey_protocol::local_dev_genesis(vec![7], "dev-policy".into());
    if file {
        ChainStore::init_file(dir, genesis, [1u8; 32], [2u8; 32]).unwrap()
    } else {
        ChainStore::init_production(dir, genesis, [1u8; 32], [2u8; 32]).unwrap()
    }
}

fn header(height: u64, parent: Hash32, app_hash: Hash32) -> BlockHeader {
    BlockHeader {
        version: 1,
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        height,
        parent_block_id: parent,
        transaction_root: [3u8; 32],
        app_hash,
        validator_set_hash: [0u8; 32],
        consensus_parameter_hash: [0u8; 32],
        protocol_version: "1".into(),
        module_registry_hash: [0u8; 32],
        codec_registry_hash: [0u8; 32],
        crypto_policy_hash: [0u8; 32],
        timestamp_unix_ms: 1,
        proposer: "DEV_BLOCK_PRODUCER".into(),
        crypto_suite_id: "dev".into(),
    }
}

#[test]
fn production_engine_is_redb() {
    let dir = temp_dir("engine");
    let store = genesis_store(&dir, false);
    assert_eq!(store.engine_name(), PRODUCTION_ENGINE_NAME);
    assert_eq!(store.health().unwrap().schema, SchemaCompatibility::Compatible);
    assert_eq!(
        DurabilityPolicy::PRODUCTION_CANDIDATE.committed_when().contains("fsynced"),
        DurabilityPolicy::DEVELOPMENT.committed_when().contains("power loss")
    );
}

#[test]
fn atomic_commit_binds_block_state_and_root() {
    let dir = temp_dir("atomic");
    let mut store = genesis_store(&dir, false);
    let mut view = store.view.clone();
    view.store.put(b"obj/k".to_vec(), b"v".to_vec());
    let app_hash = [9u8; 32];
    let hdr = header(1, [1u8; 32], app_hash);
    store.commit_block(&hdr, [4u8; 32], &[], &[], view).unwrap();
    let reopened = ChainStore::open(&dir).unwrap();
    assert_eq!(reopened.meta.height, 1);
    assert_eq!(reopened.meta.tip_block_id, hash_to_hex(&[4u8; 32]));
    assert_eq!(reopened.meta.app_hash, hash_to_hex(&app_hash));
    assert_eq!(reopened.view.store.get(b"obj/k"), Some(&b"v"[..]));
}

#[test]
fn crash_before_or_during_commit_keeps_old_state() {
    for point in [
        FailPoint::BeforeDatabaseCommit,
        FailPoint::DuringPersistence,
        FailPoint::DuringStateWrite,
        FailPoint::DuringMetadataWrite,
    ] {
        let dir = temp_dir(&format!("{point:?}"));
        let mut store = genesis_store(&dir, false);
        let genesis_hash = store.meta.app_hash.clone();
        store.fail_point = point;
        let mut view = store.view.clone();
        view.store.put(b"obj/k".to_vec(), b"partial".to_vec());
        assert!(store
            .commit_block(&header(1, [1u8; 32], [9u8; 32]), [4u8; 32], &[], &[], view)
            .is_err());
        let reopened = ChainStore::open(&dir).unwrap();
        assert_eq!(reopened.meta.height, 0);
        assert_eq!(reopened.meta.app_hash, genesis_hash);
        assert!(reopened.view.store.get(b"obj/k").is_none());
    }
}

#[test]
fn crash_after_commit_keeps_new_state() {
    let dir = temp_dir("after");
    let mut store = genesis_store(&dir, false);
    store.fail_point = FailPoint::AfterCommitBeforeResponse;
    let mut view = store.view.clone();
    view.store.put(b"obj/k".to_vec(), b"committed".to_vec());
    assert!(store
        .commit_block(&header(1, [1u8; 32], [9u8; 32]), [4u8; 32], &[], &[], view)
        .is_err());
    let reopened = ChainStore::open(&dir).unwrap();
    assert_eq!(reopened.meta.height, 1);
    assert_eq!(reopened.view.store.get(b"obj/k"), Some(&b"committed"[..]));
}

#[test]
fn file_to_production_migration_preserves_fingerprint() {
    let src = temp_dir("mig-src");
    let dest = temp_dir("mig-dest");
    let mut store = genesis_store(&src, true);
    let mut view = ChainView::default();
    view.store.put(b"ast/SUNREY".to_vec(), b"1000".to_vec());
    view.store.put(b"sys/validators".to_vec(), b"valset-v1".to_vec());
    store.view = view;
    store.meta.height = 3;
    store.meta.tip_block_id = "aa".repeat(32);
    store.meta.app_hash = "bb".repeat(32);
    store.persist_state_and_meta().unwrap();
    let before = fingerprint(&store.view, &store.meta);
    let report = migrate_file_store_to_production(&src, &dest, FailPoint::None).unwrap();
    assert!(report.verified);
    assert!(report.engineering_only);
    assert!(report.not_testnet_to_production);
    assert!(fingerprints_equal(&before, &report.destination_fingerprint));
    assert_eq!(report.source_fingerprint.height, report.destination_fingerprint.height);
    assert_eq!(report.source_fingerprint.block_id, report.destination_fingerprint.block_id);
    assert_eq!(report.source_fingerprint.state_root, report.destination_fingerprint.state_root);
    assert_eq!(
        report.source_fingerprint.native_supply,
        report.destination_fingerprint.native_supply
    );
    assert_eq!(
        report.source_fingerprint.validator_set,
        report.destination_fingerprint.validator_set
    );
    let again = migrate_file_store_to_production(&src, &dest, FailPoint::None).unwrap();
    assert_eq!(again.migration_id, report.migration_id);
}

#[test]
fn migration_crash_does_not_publish_partial_state() {
    let src = temp_dir("mig-crash-src");
    let dest = temp_dir("mig-crash-dest");
    let store = genesis_store(&src, true);
    store.persist_state_and_meta().unwrap();
    assert_eq!(
        migrate_file_store_to_production(&src, &dest, FailPoint::DuringMigration),
        Err(RejectReason::PersistenceFailure)
    );
    assert!(!dest.join(sunrey_storage::PRODUCTION_DB_FILE).exists());
}

#[test]
fn corruption_is_detected() {
    for target in ["block", "state", "meta"] {
        let dir = temp_dir(&format!("corrupt-{target}"));
        let mut store = genesis_store(&dir, false);
        let mut view = store.view.clone();
        view.store.put(b"obj/k".to_vec(), b"v".to_vec());
        store.commit_block(&header(1, [1u8; 32], [9u8; 32]), [4u8; 32], &[], &[], view).unwrap();
        store.corrupt_for_test(target).unwrap();
        let reopened = ChainStore::open(&dir);
        match target {
            "meta" => assert!(reopened.is_err() || reopened.unwrap().verify_integrity().is_err()),
            _ => {
                if let Ok(opened) = reopened {
                    assert!(opened.verify_integrity().is_err() || opened.load_block(1).is_err());
                }
            }
        }
    }
}

#[test]
fn snapshot_restore_verifies_before_availability() {
    let dir = temp_dir("snap-src");
    let dest = temp_dir("snap-dest");
    let restore_dir = temp_dir("snap-restore");
    let mut store = genesis_store(&dir, false);
    let mut view = store.view.clone();
    view.store.put(b"obj/k".to_vec(), b"snap".to_vec());
    store.commit_block(&header(1, [1u8; 32], [9u8; 32]), [4u8; 32], &[], &[], view).unwrap();
    let snap = create_production_snapshot(
        &store,
        dest,
        "net_sunrey_local_dev",
        "chn_sunrey_local_dev",
        "1",
        FailPoint::None,
    )
    .unwrap();
    assert_eq!(snap.manifest.storage_schema, PRODUCTION_SCHEMA_VERSION);
    verify_production_snapshot(&snap).unwrap();
    let restored = restore_production_snapshot(&snap, &restore_dir).unwrap();
    assert_eq!(restored.meta.height, 1);
    assert_eq!(restored.meta.app_hash, store.meta.app_hash);
    mutate_snapshot_chunk(&snap).unwrap();
    assert!(verify_production_snapshot(&snap).is_err());
}

#[test]
fn archive_retains_history_pruned_drops_only_safe_blocks() {
    assert!(!NodeRetentionMode::Archive.may_drop_block(1, 100));
    let pruned = NodeRetentionMode::pruned(2);
    assert!(!pruned.may_drop_block(100, 100));
    assert!(!pruned.may_drop_block(99, 100));
    assert!(pruned.may_drop_block(1, 100));
}

#[test]
fn schema_and_wal_domains() {
    let current = SchemaRecord::production();
    assert_eq!(
        SchemaRecord::classify(Some(&current), PRODUCTION_SCHEMA_VERSION),
        SchemaCompatibility::Compatible
    );
    assert_ne!(WalDomain::Consensus.kind(), WalDomain::SignerSafety.kind());
    assert_ne!(WalDomain::ApplicationStateCommit.kind(), WalDomain::Consensus.kind());
}

#[test]
fn state_root_rebuild_matches_store() {
    let dir = temp_dir("rebuild");
    let store = genesis_store(&dir, false);
    let suite = DevEd25519Sha256Suite;
    let rebuilt = rebuild_state_root(&store, &suite).unwrap();
    assert_eq!(rebuilt.rebuilt_state_root, hash_to_hex(&store.view.store.app_hash(&suite)));
    let mut live = store;
    live.meta.app_hash = rebuilt.rebuilt_state_root.clone();
    live.persist_state_and_meta().unwrap();
    assert_state_root(&live, &suite).unwrap();
}
