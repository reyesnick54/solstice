use sunrey_consensus::{
    exceeds_two_thirds, four_validator_set, max_byzantine_power, two_thirds_threshold,
};
use sunrey_protocol::{classify_finality, FinalitySource, TransactionFinality};

#[test]
fn fault_threshold_is_less_than_one_third() {
    let set = four_validator_set().unwrap();
    let total = set.total_active_power().unwrap();
    assert_eq!(total, 40);
    assert_eq!(max_byzantine_power(total).unwrap(), 13);
    assert_eq!(two_thirds_threshold(total).unwrap(), 27);
    assert!(exceeds_two_thirds(30, total).unwrap());
    assert!(!exceeds_two_thirds(20, total).unwrap());
    assert_eq!(set.validators.len(), 4);
}

#[test]
fn commit_certificate_not_local_height_is_finality() {
    assert_eq!(
        classify_finality(FinalitySource::LocalBlockObservation),
        TransactionFinality::Included
    );
    assert_eq!(
        classify_finality(FinalitySource::CommitCertificate),
        TransactionFinality::Finalized
    );
}
