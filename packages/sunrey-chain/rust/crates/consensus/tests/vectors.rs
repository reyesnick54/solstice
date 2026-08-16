use serde::Deserialize;
use sunrey_consensus::{four_validator_set, Height, Round};

#[derive(Deserialize)]
struct VectorFile {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    height: u64,
    round: u32,
    proposer: String,
}

#[test]
fn deterministic_proposer_vectors() {
    let raw = include_str!("../vectors/proposer.json");
    let file: VectorFile = serde_json::from_str(raw).unwrap();
    let set = four_validator_set().unwrap();
    for case in file.cases {
        let got = set.select_proposer(Height::new(case.height), Round::new(case.round)).unwrap();
        assert_eq!(got.as_str(), case.proposer, "height {} round {}", case.height, case.round);
    }
}
