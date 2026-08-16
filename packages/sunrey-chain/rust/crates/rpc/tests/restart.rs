use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use sunrey_node::LocalNode;

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_sunrey-node")
}

fn wait_health(addr: &str) {
    let start = Instant::now();
    loop {
        if sunrey_rpc::http_get(addr, "/health").is_ok() {
            return;
        }
        if start.elapsed() > Duration::from_secs(5) {
            panic!("node did not become ready");
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn json_body(response: &str) -> &str {
    response.split("\r\n\r\n").nth(1).unwrap_or(response)
}

fn spawn_node(dir: &std::path::Path, listen: &str) -> std::process::Child {
    Command::new(bin())
        .arg("run")
        .arg("--data-dir")
        .arg(dir)
        .arg("--listen")
        .arg(listen)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap()
}

#[test]
fn restart_recovers_exact_state() {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("sunrey-restart-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    let init = Command::new(bin()).arg("init").arg("--data-dir").arg(&dir).status().unwrap();
    assert!(init.success());

    let listen = format!("127.0.0.1:{}", 19000 + (nanos % 1000) as u16);
    let mut child = spawn_node(&dir, &listen);
    wait_health(&listen);

    let hex = Command::new(bin())
        .arg("encode-fixture")
        .arg("--name")
        .arg("system-note")
        .output()
        .unwrap();
    assert!(hex.status.success());
    let tx_hex = String::from_utf8(hex.stdout).unwrap();
    let body = format!("{{\"hex\":\"{}\"}}", tx_hex.trim());
    let submitted = sunrey_rpc::http_post(&listen, "/tx", &body).unwrap();
    assert!(json_body(&submitted).contains("tx_id"), "{submitted}");
    let produced = sunrey_rpc::http_post(&listen, "/admin/produce-block", "{}").unwrap();
    assert!(json_body(&produced).contains("height"), "{produced}");

    let before = LocalNode::open(&dir).unwrap();
    let height = before.store.meta.height;
    let root = before.store.meta.app_hash.clone();
    let block_id = before.store.meta.tip_block_id.clone();
    assert_eq!(height, 1);

    let _ = child.kill();
    let _ = child.wait();

    let mut restarted = spawn_node(&dir, &listen);
    wait_health(&listen);
    let status = sunrey_rpc::http_get(&listen, "/status").unwrap();
    assert!(json_body(&status).contains(&root), "{status}");
    assert!(json_body(&status).contains(&block_id), "{status}");
    let after = LocalNode::open(&dir).unwrap();
    assert_eq!(after.store.meta.height, height);
    assert_eq!(after.store.meta.app_hash, root);
    after.verify_chain().unwrap();

    let produced2 = sunrey_rpc::http_post(&listen, "/admin/produce-block", "{}").unwrap();
    assert!(json_body(&produced2).contains("height"), "{produced2}");
    let continued = LocalNode::open(&dir).unwrap();
    assert_eq!(continued.store.meta.height, 2);
    assert!(!continued.store.meta.tip_block_id.is_empty());
    continued.verify_chain().unwrap();
    let _ = restarted.kill();
    let _ = restarted.wait();
}
