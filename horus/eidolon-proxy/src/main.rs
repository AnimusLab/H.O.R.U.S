use axum::{routing::get, Json, Router};
use serde_json::json;
use std::net::SocketAddr;

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "service": "eidolon-gateway",
        "status": "READY",
        "mode": "LOCAL_AUDIT_ONLY",
        "outbound_forwarding": false
    }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/eidolon/status", get(health));
    let address = SocketAddr::from(([0, 0, 0, 0], 5000));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("gateway port must be available");
    println!("Eidolon local audit gateway listening on http://{address}");
    axum::serve(listener, app).await.expect("gateway failed");
}
