use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::HeaderValue,
    response::IntoResponse,
    routing::get,
    Router,
};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    },
};
use tokio::{
    sync::broadcast,
    time::{sleep, Duration},
};
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    events: broadcast::Sender<String>,
    activity: ActivityMetrics,
}

#[derive(Clone, Default)]
struct ActivityMetrics {
    websocket_clients: Arc<AtomicUsize>,
    feed_requests: Arc<AtomicU64>,
    feed_failures: Arc<AtomicU64>,
    events_broadcast: Arc<AtomicU64>,
    last_success: Arc<Mutex<HashMap<String, String>>>,
}

#[derive(Serialize)]
struct ActivitySnapshot {
    service: &'static str,
    status: &'static str,
    websocket_clients: usize,
    feed_requests: u64,
    feed_failures: u64,
    events_broadcast: u64,
    last_success: HashMap<String, String>,
}

#[derive(Serialize)]
struct TelemetryPayload {
    schema_version: u8,
    system_status: String,
    defcon: u8,
    timestamp: String,
    network_latency_ms: u64,
    active_events_count: usize,
    active_node: String,
    source: String,
    latest_intel: String,
    distance_km: f64,
    events: Vec<PublicEvent>,
    feed_status: String,
    feed_last_success: Option<String>,
}

#[derive(Serialize)]
struct PublicEvent {
    id: String,
    category: String,
    source: String,
    severity: String,
    timestamp: String,
    latitude: f64,
    longitude: f64,
    title: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct UsgsFeed {
    features: Vec<UsgsFeature>,
}

#[derive(Deserialize)]
struct UsgsFeature {
    id: String,
    properties: UsgsProperties,
    geometry: Option<UsgsGeometry>,
}

#[derive(Deserialize)]
struct UsgsProperties {
    title: Option<String>,
    mag: Option<f64>,
}

#[derive(Deserialize)]
struct UsgsGeometry {
    coordinates: Vec<f64>,
}

#[derive(Deserialize)]
struct NoaaFeed {
    features: Vec<NoaaFeature>,
}

#[derive(Deserialize)]
struct NoaaFeature {
    id: String,
    properties: NoaaProperties,
    geometry: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct NoaaProperties {
    event: Option<String>,
    headline: Option<String>,
    severity: Option<String>,
}

unsafe extern "C" {
    fn compute_haversine_ffi(
        latitude_a: f64,
        longitude_a: f64,
        latitude_b: f64,
        longitude_b: f64,
    ) -> f64;
}

#[tokio::main]
async fn main() {
    let usgs_feed_url = std::env::var("USGS_FEED_URL").unwrap_or_else(|_| {
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson".to_string()
    });
    let poll_interval_seconds = std::env::var("USGS_POLL_INTERVAL_SECONDS")
        .unwrap_or_else(|_| "60".to_string())
        .parse::<u64>()
        .expect("USGS_POLL_INTERVAL_SECONDS must be an integer");
    let noaa_alerts_url = std::env::var("NOAA_ALERTS_URL")
        .unwrap_or_else(|_| "https://api.weather.gov/alerts/active".to_string());
    let noaa_poll_interval_seconds = std::env::var("NOAA_POLL_INTERVAL_SECONDS")
        .unwrap_or_else(|_| "120".to_string())
        .parse::<u64>()
        .expect("NOAA_POLL_INTERVAL_SECONDS must be an integer");
    let (events, _) = broadcast::channel(32);
    let state = Arc::new(AppState {
        events,
        activity: ActivityMetrics::default(),
    });
    spawn_demo_worker(
        Arc::clone(&state),
        "news-worker",
        vec![
            "Public news feed: Paris protest activity updated",
            "Public news feed: regional election report updated",
        ],
        "GDELT_DEMO",
    );
    spawn_demo_worker(
        Arc::clone(&state),
        "air-worker",
        vec![
            "Public ADS-B sample: flight position batch updated",
            "Public ADS-B sample: regional track batch updated",
        ],
        "ADS_B_DEMO",
    );
    spawn_public_feed_worker(Arc::clone(&state), usgs_feed_url, poll_interval_seconds);
    spawn_noaa_worker(
        Arc::clone(&state),
        noaa_alerts_url,
        noaa_poll_interval_seconds,
    );

    let app = build_app(state);

    let address = SocketAddr::from(([0, 0, 0, 0], 4000));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("telemetry server port must be available");
    println!("H.O.R.U.S. telemetry broker listening on ws://{address}/ws/telemetry");
    axum::serve(listener, app)
        .await
        .expect("telemetry server failed");
}

fn build_app(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([axum::http::Method::GET]);
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/activity", get(activity_handler))
        .route("/ws/telemetry", get(ws_handler))
        .with_state(state)
        .layer(cors)
}

async fn activity_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let last_success = state
        .activity
        .last_success
        .lock()
        .expect("activity metrics lock must not be poisoned")
        .clone();
    axum::Json(ActivitySnapshot {
        service: "horus-server",
        status: "ACTIVE",
        websocket_clients: state.activity.websocket_clients.load(Ordering::Relaxed),
        feed_requests: state.activity.feed_requests.load(Ordering::Relaxed),
        feed_failures: state.activity.feed_failures.load(Ordering::Relaxed),
        events_broadcast: state.activity.events_broadcast.load(Ordering::Relaxed),
        last_success,
    })
}

fn spawn_demo_worker(
    state: Arc<AppState>,
    worker_name: &'static str,
    messages: Vec<&'static str>,
    source: &'static str,
) {
    tokio::spawn(async move {
        let mut index = 0;
        loop {
            let payload = TelemetryPayload {
                schema_version: 1,
                system_status: "ACTIVE_MONITORING".to_string(),
                defcon: 3,
                timestamp: Utc::now().to_rfc3339(),
                network_latency_ms: rand::thread_rng().gen_range(10..=18),
                active_events_count: 4,
                active_node: "GLOBAL_GRID_MESH".to_string(),
                source: source.to_string(),
                latest_intel: messages[index % messages.len()].to_string(),
                distance_km: paris_tehran_distance(),
                events: Vec::new(),
                feed_status: "DEMO".to_string(),
                feed_last_success: None,
            };
            publish_payload(&state, payload);
            println!("[{worker_name}] published demo telemetry");
            index += 1;
            sleep(Duration::from_secs(3)).await;
        }
    });
}

fn paris_tehran_distance() -> f64 {
    let distance = unsafe { compute_haversine_ffi(48.8566, 2.3522, 35.6892, 51.3890) };
    if distance >= 0.0 {
        distance
    } else {
        0.0
    }
}

fn spawn_public_feed_worker(state: Arc<AppState>, feed_url: String, poll_interval_seconds: u64) {
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            state.activity.feed_requests.fetch_add(1, Ordering::Relaxed);
            match fetch_usgs_events(&client, &feed_url).await {
                Ok(events) if !events.is_empty() => {
                    let latest_intel =
                        format!("USGS public feed: {} earthquakes received", events.len());
                    let payload = TelemetryPayload {
                        schema_version: 1,
                        system_status: "ACTIVE_MONITORING".to_string(),
                        defcon: 3,
                        timestamp: Utc::now().to_rfc3339(),
                        network_latency_ms: rand::thread_rng().gen_range(10..=18),
                        active_events_count: events.len(),
                        active_node: "USGS_PUBLIC_FEED".to_string(),
                        source: "USGS_EARTHQUAKES".to_string(),
                        latest_intel,
                        distance_km: paris_tehran_distance(),
                        events,
                        feed_status: "HEALTHY".to_string(),
                        feed_last_success: Some(Utc::now().to_rfc3339()),
                    };
                    mark_feed_success(&state.activity, "USGS_EARTHQUAKES");
                    publish_payload(&state, payload);
                }
                Ok(_) => println!("[usgs-worker] feed returned no usable events"),
                Err(error) => {
                    state.activity.feed_failures.fetch_add(1, Ordering::Relaxed);
                    eprintln!("[usgs-worker] public feed error: {error}");
                }
            }
            sleep(Duration::from_secs(poll_interval_seconds)).await;
        }
    });
}

fn spawn_noaa_worker(state: Arc<AppState>, feed_url: String, poll_interval_seconds: u64) {
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            state.activity.feed_requests.fetch_add(1, Ordering::Relaxed);
            match fetch_noaa_events(&client, &feed_url).await {
                Ok(events) => {
                    mark_feed_success(&state.activity, "NOAA_ALERTS");
                    let payload = TelemetryPayload {
                        schema_version: 1,
                        system_status: "ACTIVE_MONITORING".to_string(),
                        defcon: 3,
                        timestamp: Utc::now().to_rfc3339(),
                        network_latency_ms: rand::thread_rng().gen_range(10..=18),
                        active_events_count: events.len(),
                        active_node: "NOAA_PUBLIC_FEED".to_string(),
                        source: "NOAA_ALERTS".to_string(),
                        latest_intel: format!(
                            "NOAA public feed: {} active alerts received",
                            events.len()
                        ),
                        distance_km: paris_tehran_distance(),
                        events,
                        feed_status: "HEALTHY".to_string(),
                        feed_last_success: Some(Utc::now().to_rfc3339()),
                    };
                    publish_payload(&state, payload);
                }
                Err(error) => {
                    state.activity.feed_failures.fetch_add(1, Ordering::Relaxed);
                    eprintln!("[noaa-worker] public feed error: {error}");
                }
            }
            sleep(Duration::from_secs(poll_interval_seconds)).await;
        }
    });
}

fn publish_payload(state: &AppState, payload: TelemetryPayload) {
    if let Ok(serialized) = serde_json::to_string(&payload) {
        state
            .activity
            .events_broadcast
            .fetch_add(payload.active_events_count as u64, Ordering::Relaxed);
        let _ = state.events.send(serialized);
    }
}

fn mark_feed_success(activity: &ActivityMetrics, source: &str) {
    activity
        .last_success
        .lock()
        .expect("activity metrics lock must not be poisoned")
        .insert(source.to_string(), Utc::now().to_rfc3339());
}

async fn fetch_usgs_events(
    client: &reqwest::Client,
    feed_url: &str,
) -> Result<Vec<PublicEvent>, String> {
    let mut last_error = String::from("unknown feed error");
    for attempt in 0..3 {
        let result = client
            .get(feed_url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|error| error.to_string())
            .and_then(|response| {
                response
                    .error_for_status()
                    .map_err(|error| error.to_string())
            });
        match result {
            Ok(response) => match response
                .json::<UsgsFeed>()
                .await
                .map_err(|error| error.to_string())
            {
                Ok(feed) => {
                    return Ok(feed
                        .features
                        .into_iter()
                        .filter_map(public_event)
                        .take(25)
                        .collect())
                }
                Err(error) => last_error = error,
            },
            Err(error) => last_error = error,
        }

        if attempt < 2 {
            sleep(Duration::from_secs(2_u64.pow(attempt + 1))).await;
        }
    }
    Err(last_error)
}

async fn fetch_noaa_events(
    client: &reqwest::Client,
    feed_url: &str,
) -> Result<Vec<PublicEvent>, String> {
    let response = client
        .get(feed_url)
        .header("User-Agent", "H.O.R.U.S telemetry dashboard contact: local")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let feed = response
        .json::<NoaaFeed>()
        .await
        .map_err(|error| error.to_string())?;
    Ok(feed
        .features
        .into_iter()
        .filter_map(noaa_event)
        .take(25)
        .collect())
}

fn public_event(feature: UsgsFeature) -> Option<PublicEvent> {
    let coordinates = feature.geometry?.coordinates;
    let longitude = *coordinates.first()?;
    let latitude = *coordinates.get(1)?;
    if !(-90.0..=90.0).contains(&latitude) || !(-180.0..=180.0).contains(&longitude) {
        return None;
    }

    let magnitude = feature.properties.mag.unwrap_or(0.0);
    Some(PublicEvent {
        id: format!("usgs-{}", feature.id),
        category: "anomaly".to_string(),
        source: "USGS_EARTHQUAKES".to_string(),
        severity: match magnitude {
            value if value >= 6.0 => "CRITICAL",
            value if value >= 4.5 => "HIGH",
            value if value >= 2.5 => "MODERATE",
            _ => "LOW",
        }
        .to_string(),
        timestamp: Utc::now().to_rfc3339(),
        latitude,
        longitude,
        title: format!(
            "USGS earthquake M{magnitude:.1}: {}",
            feature
                .properties
                .title
                .unwrap_or_else(|| "location unavailable".to_string())
        ),
        tags: vec!["USGS".to_string(), "EARTHQUAKE".to_string()],
    })
}

fn noaa_event(feature: NoaaFeature) -> Option<PublicEvent> {
    let geometry = feature.geometry?;
    let coordinates = geometry.get("coordinates")?.as_array()?;
    let ring = coordinates.first()?.as_array()?;
    let first = ring.first()?.as_array()?;
    let longitude = first.first()?.as_f64()?;
    let latitude = first.get(1)?.as_f64()?;
    if !(-90.0..=90.0).contains(&latitude) || !(-180.0..=180.0).contains(&longitude) {
        return None;
    }
    let severity = feature
        .properties
        .severity
        .unwrap_or_else(|| "Unknown".to_string());
    let event = feature
        .properties
        .event
        .unwrap_or_else(|| "Weather alert".to_string());
    Some(PublicEvent {
        id: format!("noaa-{}", feature.id),
        category: "anomaly".to_string(),
        source: "NOAA_ALERTS".to_string(),
        severity: severity.to_uppercase(),
        timestamp: Utc::now().to_rfc3339(),
        latitude,
        longitude,
        title: format!(
            "NOAA {severity}: {}",
            feature.properties.headline.unwrap_or(event)
        ),
        tags: vec!["NOAA".to_string(), "WEATHER".to_string()],
    })
}

async fn ws_handler(
    State(state): State<Arc<AppState>>,
    websocket: WebSocketUpgrade,
) -> impl IntoResponse {
    websocket.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    state
        .activity
        .websocket_clients
        .fetch_add(1, Ordering::Relaxed);
    let mut events = state.events.subscribe();
    let (mut sender, mut receiver) = socket.split();
    loop {
        tokio::select! {
            payload = next_broadcast_payload(&mut events) => {
                let Some(payload) = payload else { break };
                if sender.send(Message::Text(payload)).await.is_err() {
                    break;
                }
            }
            message = receiver.next() => {
                match message {
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    Some(Ok(_)) => {}
                }
            }
        }
    }
    state
        .activity
        .websocket_clients
        .fetch_sub(1, Ordering::Relaxed);
}

async fn next_broadcast_payload(events: &mut broadcast::Receiver<String>) -> Option<String> {
    loop {
        match events.recv().await {
            Ok(payload) => return Some(payload),
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => return None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feature(
        id: &str,
        coordinates: Vec<f64>,
        title: Option<&str>,
        magnitude: Option<f64>,
    ) -> UsgsFeature {
        UsgsFeature {
            id: id.to_string(),
            properties: UsgsProperties {
                title: title.map(str::to_string),
                mag: magnitude,
            },
            geometry: Some(UsgsGeometry { coordinates }),
        }
    }

    #[test]
    fn normalizes_valid_usgs_event() {
        let event = public_event(feature(
            "abc123",
            vec![-118.25, 34.05, 10.0],
            Some("10km north of Los Angeles"),
            Some(4.2),
        ))
        .expect("valid event should be normalized");

        assert_eq!(event.id, "usgs-abc123");
        assert_eq!(event.category, "anomaly");
        assert_eq!(event.latitude, 34.05);
        assert_eq!(event.longitude, -118.25);
        assert!(event.title.contains("M4.2"));
        assert!(event.title.contains("Los Angeles"));
        assert_eq!(event.tags, vec!["USGS", "EARTHQUAKE"]);
    }

    #[test]
    fn rejects_invalid_coordinates() {
        assert!(public_event(feature("bad-latitude", vec![-118.25, 91.0], None, None)).is_none());
        assert!(public_event(feature("bad-longitude", vec![181.0, 34.05], None, None)).is_none());
        assert!(public_event(feature("missing-latitude", vec![-118.25], None, None)).is_none());
        assert!(public_event(UsgsFeature {
            id: "missing-geometry".to_string(),
            properties: UsgsProperties {
                title: None,
                mag: None
            },
            geometry: None,
        })
        .is_none());
    }

    #[test]
    fn uses_safe_defaults_for_optional_usgs_fields() {
        let event = public_event(feature("defaults", vec![0.0, 0.0], None, None))
            .expect("coordinates at origin are valid");

        assert_eq!(event.title, "USGS earthquake M0.0: location unavailable");
        assert_eq!(event.tags, vec!["USGS", "EARTHQUAKE"]);
    }

    #[test]
    fn normalizes_noaa_polygon_alert() {
        let event = noaa_event(NoaaFeature {
            id: "alert-123".to_string(),
            properties: NoaaProperties {
                event: Some("Severe Thunderstorm Warning".to_string()),
                headline: Some("Severe thunderstorms expected".to_string()),
                severity: Some("Severe".to_string()),
            },
            geometry: Some(serde_json::json!({
                "type": "Polygon",
                "coordinates": [[[-97.0, 35.0], [-96.0, 35.0], [-96.0, 36.0], [-97.0, 35.0]]]
            })),
        })
        .expect("valid NOAA polygon should be normalized");

        assert_eq!(event.id, "noaa-alert-123");
        assert_eq!(event.latitude, 35.0);
        assert_eq!(event.longitude, -97.0);
        assert!(event.title.contains("Severe"));
        assert_eq!(event.tags, vec!["NOAA", "WEATHER"]);
    }

    #[tokio::test]
    async fn websocket_broadcasts_valid_telemetry_payload() {
        use futures_util::StreamExt;
        use tokio_tungstenite::{connect_async, tungstenite::Message as ClientMessage};

        let (events, _) = broadcast::channel(4);
        let state = Arc::new(AppState {
            events,
            activity: ActivityMetrics::default(),
        });
        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("test listener should bind");
        let address = listener
            .local_addr()
            .expect("test listener should have an address");
        let server_state = Arc::clone(&state);
        let server = tokio::spawn(async move {
            axum::serve(listener, build_app(server_state))
                .await
                .expect("test server should run");
        });
        let url = format!("ws://{address}/ws/telemetry");
        let (mut socket, _) = connect_async(url).await.expect("websocket should connect");

        let payload = serde_json::json!({
            "schema_version": 1,
            "system_status": "ACTIVE_MONITORING",
            "defcon": 3,
            "timestamp": "2026-11-12T19:00:00Z",
            "network_latency_ms": 12,
            "active_events_count": 1,
            "active_node": "TEST_NODE",
            "source": "TEST",
            "latest_intel": "integration test telemetry",
            "distance_km": 4208.36,
            "events": [],
            "feed_status": "HEALTHY",
            "feed_last_success": "2026-11-12T19:00:00Z"
        });
        state
            .events
            .send(payload.to_string())
            .expect("test payload should broadcast");

        let message = tokio::time::timeout(Duration::from_secs(2), socket.next())
            .await
            .expect("telemetry frame should arrive")
            .expect("websocket should remain open")
            .expect("telemetry frame should be valid");
        let ClientMessage::Text(text) = message else {
            panic!("expected a text telemetry frame");
        };
        let received: serde_json::Value =
            serde_json::from_str(&text).expect("telemetry frame should be JSON");
        for field in [
            "schema_version",
            "system_status",
            "defcon",
            "timestamp",
            "network_latency_ms",
            "active_events_count",
            "active_node",
            "source",
            "latest_intel",
            "distance_km",
            "events",
            "feed_status",
            "feed_last_success",
        ] {
            assert!(
                received.get(field).is_some(),
                "missing telemetry field: {field}"
            );
        }
        assert_eq!(received["schema_version"], 1);
        assert_eq!(received["source"], "TEST");
        assert_eq!(received["events"].as_array().map(Vec::len), Some(0));

        socket.close(None).await.expect("websocket should close");
        server.abort();
    }

    #[tokio::test]
    async fn lagged_broadcast_receiver_recovers_with_latest_payload() {
        let (events, _) = broadcast::channel(1);
        let mut receiver = events.subscribe();
        events
            .send("stale".to_string())
            .expect("stale payload should broadcast");
        events
            .send("latest".to_string())
            .expect("latest payload should replace stale payload");

        let payload = next_broadcast_payload(&mut receiver).await;

        assert_eq!(payload, Some("latest".to_string()));
    }
}
