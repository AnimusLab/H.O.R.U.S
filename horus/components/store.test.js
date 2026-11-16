import { beforeEach, describe, expect, it } from 'vitest';
import { applyTelemetryPayload, findPlace, useHorus, validTelemetry } from './store';
import { interpretVoiceCommand } from './VoiceConsole';

const payload = (overrides = {}) => ({
  schema_version: 1,
  system_status: 'ACTIVE_MONITORING',
  defcon: 3,
  timestamp: '2026-11-14T11:00:00Z',
  network_latency_ms: 12,
  active_events_count: 1,
  active_node: 'USGS_PUBLIC_FEED',
  source: 'USGS_EARTHQUAKES',
  latest_intel: 'USGS public feed update',
  distance_km: 4208.36,
  events: [{
    id: 'usgs-test-1',
    category: 'anomaly',
    source: 'USGS_EARTHQUAKES',
    severity: 'MODERATE',
    timestamp: '2026-11-14T11:00:00Z',
    latitude: 34.05,
    longitude: -118.25,
    title: 'USGS earthquake M4.2',
    tags: ['USGS', 'EARTHQUAKE'],
  }],
  feed_status: 'HEALTHY',
  feed_last_success: '2026-11-14T11:00:00Z',
  ...overrides,
});

beforeEach(() => {
  useHorus.setState({
    events: [],
    logs: [],
    feedStatusBySource: {
      USGS_EARTHQUAKES: { status: 'UNKNOWN', lastSuccess: null, eventCount: 0 },
      NOAA_ALERTS: { status: 'UNKNOWN', lastSuccess: null, eventCount: 0 },
    },
  });
});

describe('telemetry contract', () => {
  it('interprets local voice commands without requiring an external AI service', () => {
    useHorus.setState({ layers: { pings: true, air: false, ships: false, sats: false }, mode: '2d', focus: null });

    expect(interpretVoiceCommand('take me to Tehran')).toMatchObject({ ok: true });
    expect(useHorus.getState().focus).toEqual({ lat: 35.69, lon: 51.39 });

    interpretVoiceCommand('show flights and switch to 3D');
    expect(useHorus.getState().layers.air).toBe(true);
    expect(useHorus.getState().mode).toBe('3d');
  });

  it('resolves geographic place searches locally', () => {
    expect(findPlace('china')).toMatchObject({ name: 'china', coordinates: [35.86, 104.19] });
    expect(findPlace('Beijing')).toMatchObject({ name: 'beijing', coordinates: [39.90, 116.40] });
    expect(findPlace('unknown place')).toBeNull();
  });

  it('accepts versioned telemetry and rejects unsupported versions', () => {
    expect(validTelemetry(payload())).toBe(true);
    expect(validTelemetry(payload({ schema_version: 2 }))).toBe(false);
    expect(validTelemetry(payload({ source: undefined }))).toBe(false);
  });

  it('tracks USGS and NOAA status independently', () => {
    applyTelemetryPayload(payload());
    applyTelemetryPayload(payload({
      source: 'NOAA_ALERTS',
      active_node: 'NOAA_PUBLIC_FEED',
      active_events_count: 4,
      feed_last_success: '2026-11-14T11:01:00Z',
      events: [],
    }));

    const { feedStatusBySource } = useHorus.getState();
    expect(feedStatusBySource.USGS_EARTHQUAKES).toMatchObject({
      status: 'HEALTHY',
      eventCount: 1,
    });
    expect(feedStatusBySource.NOAA_ALERTS).toMatchObject({
      status: 'HEALTHY',
      eventCount: 4,
    });
  });

  it('deduplicates events received from repeated telemetry frames', () => {
    applyTelemetryPayload(payload());
    applyTelemetryPayload(payload());

    expect(useHorus.getState().events).toHaveLength(1);
  });

  it('ignores malformed telemetry without changing feed state', () => {
    expect(applyTelemetryPayload(payload({ events: [{ id: 'invalid' }] }))).toBe(false);
    expect(useHorus.getState().feedStatusBySource.USGS_EARTHQUAKES.status).toBe('UNKNOWN');
  });

  it('toggles source and severity filters independently', () => {
    useHorus.getState().toggleSource('NOAA_ALERTS');
    useHorus.getState().toggleSeverity('CRITICAL');

    expect(useHorus.getState().sourceFilters.NOAA_ALERTS).toBe(false);
    expect(useHorus.getState().sourceFilters.USGS_EARTHQUAKES).toBe(true);
    expect(useHorus.getState().severityFilters.CRITICAL).toBe(false);
    expect(useHorus.getState().severityFilters.HIGH).toBe(true);
  });
});
