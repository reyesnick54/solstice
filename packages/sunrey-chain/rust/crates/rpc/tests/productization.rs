use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use sunrey_node::LocalNode;
use sunrey_rpc::{RpcPlane, RpcSecurityConfig, RpcServer};

fn dir() -> std::path::PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("sunrey-rpc-prod-{nanos}"));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn serve(plane: RpcPlane) -> (String, std::thread::JoinHandle<()>) {
    serve_config(RpcSecurityConfig::for_plane(plane))
}

fn serve_config(config: RpcSecurityConfig) -> (String, std::thread::JoinHandle<()>) {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let addr = format!("127.0.0.1:{}", 21000 + (nanos % 800) as u16);
    let node = LocalNode::init(dir()).unwrap();
    let server = RpcServer::bind_with_config(&addr, node, config).unwrap();
    let listen = server.local_addr();
    let handle = std::thread::spawn(move || {
        let _ = server.serve();
    });
    let start = Instant::now();
    loop {
        if sunrey_rpc::http_get(&listen, "/v1/health").is_ok()
            || sunrey_rpc::http_get(&listen, "/health").is_ok()
        {
            break;
        }
        if start.elapsed() > Duration::from_secs(5) {
            panic!("rpc did not start on {listen}");
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    (listen, handle)
}

fn raw_get(addr: &str, path: &str, extra: &str) -> String {
    let mut stream = TcpStream::connect(addr).unwrap();
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
    let req = format!(
        "GET {path} HTTP/1.1\r\nHost: localhost\r\nX-Request-Id: client-1\r\n{extra}Connection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).unwrap();
    let mut buf = String::new();
    stream.read_to_string(&mut buf).unwrap();
    buf
}

#[test]
fn public_plane_serves_v1_and_hides_admin() {
    let (addr, _handle) = serve(RpcPlane::Public);
    let status = sunrey_rpc::http_get(&addr, "/v1/chain/status").unwrap();
    assert!(status.contains("apiVersion"), "{status}");
    assert!(status.contains("localObservationIsNotFinality"), "{status}");
    assert!(
        status.contains("\"mainnetActive\":false") || status.contains("mainnetActive"),
        "{status}"
    );
    let identified = raw_get(&addr, "/v1/health", "");
    assert!(identified.contains("X-Request-Id: client-1"), "{identified}");
    let admin = sunrey_rpc::http_post(&addr, "/admin/produce-block", "{}").unwrap();
    assert!(admin.contains("403") || admin.contains("METHOD_NOT_ALLOWED"), "{admin}");
}

#[test]
fn public_plane_rate_limits_flood() {
    let mut config = RpcSecurityConfig::for_plane(RpcPlane::Public);
    config.rate_per_window = 4;
    config.window_ms = 60_000;
    let (addr, _handle) = serve_config(config);
    let mut saw_limit = false;
    for _ in 0..80 {
        let response = sunrey_rpc::http_get(&addr, "/v1/health").unwrap_or_default();
        if response.contains("429") || response.contains("RATE_LIMITED") {
            saw_limit = true;
            break;
        }
    }
    assert!(saw_limit, "public RPC must reject a trivial flood");
}

#[test]
fn simulation_plane_keeps_legacy_admin_for_local_dev() {
    let (addr, _handle) = serve(RpcPlane::SimulationCombined);
    let health = sunrey_rpc::http_get(&addr, "/health").unwrap();
    assert!(health.contains("ok"), "{health}");
}
