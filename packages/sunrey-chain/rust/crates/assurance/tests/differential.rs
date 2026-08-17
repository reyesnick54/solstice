use serde_json::Value;
use sunrey_assurance::{
    development_fee, rust_fingerprint, rust_formula, rust_median, rust_mul_div,
};

fn load_cases() -> Vec<Value> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../tests/assurance/corpus/differential/cases.json"
    );
    let raw = std::fs::read_to_string(path).expect("differential cases");
    serde_json::from_str::<Value>(&raw).expect("json").as_array().cloned().unwrap_or_default()
}

#[test]
fn typescript_and_rust_agree_on_shared_cases() {
    for case in load_cases() {
        let kind = case["kind"].as_str().unwrap_or("");
        let input = &case["input"];
        let expected = &case["expected"];
        match kind {
            "fee" => {
                let fee = development_fee(
                    input["encodedBytes"].as_u64().unwrap() as u128,
                    input["signatureCount"].as_u64().unwrap() as u128,
                )
                .unwrap();
                assert_eq!(fee.to_string(), expected["fee"].as_str().unwrap());
            }
            "muldiv" => {
                let value = rust_mul_div(
                    input["value"].as_u64().unwrap() as u128,
                    input["numerator"].as_u64().unwrap() as u128,
                    input["denominator"].as_u64().unwrap() as u128,
                    input["rounding"].as_str().unwrap(),
                );
                assert_eq!(value.to_string(), expected["value"].as_str().unwrap());
            }
            "formula" => {
                let (uncapped, moonrey) = rust_formula(
                    input["eligible"].as_u64().unwrap() as u128,
                    input["categoryWeight"].as_u64().unwrap() as u128,
                    input["claimWeight"].as_u64().unwrap() as u128,
                    input["quality"].as_u64().unwrap() as u128,
                    input["rounding"].as_str().unwrap(),
                    input["maximum"].as_u64().unwrap() as u128,
                );
                assert_eq!(uncapped, expected["uncapped"].as_str().unwrap());
                assert_eq!(moonrey, expected["moonrey"].as_str().unwrap());
            }
            "fingerprint" => {
                let facts: Vec<&str> = input["facts"].as_str().unwrap().split(',').collect();
                let upstream: Vec<&str> = input["upstream"]
                    .as_str()
                    .unwrap()
                    .split(',')
                    .filter(|part| !part.is_empty())
                    .collect();
                let hash = rust_fingerprint(
                    input["objectId"].as_str().unwrap(),
                    input["epoch"].as_u64().unwrap(),
                    input["validFrom"].as_u64().unwrap(),
                    input["validUntil"].as_u64().unwrap(),
                    input["claimType"].as_str().unwrap(),
                    input["category"].as_str().unwrap(),
                    input["normalized"].as_u64().unwrap() as u128,
                    input["baseUnit"].as_str().unwrap(),
                    &facts,
                    &upstream,
                );
                assert_eq!(hash, expected["hash"].as_str().unwrap());
            }
            "median" => {
                let values: Vec<u64> = input["values"]
                    .as_str()
                    .unwrap()
                    .split(',')
                    .map(|part| part.parse().unwrap())
                    .collect();
                assert_eq!(rust_median(&values).to_string(), expected["median"].as_str().unwrap());
            }
            _ => {}
        }
    }
}
