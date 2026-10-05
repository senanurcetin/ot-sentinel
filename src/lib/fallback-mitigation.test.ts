import { buildFallbackAlert, isPrivateIpv4 } from '@/lib/fallback-mitigation';
import type { ThreatMitigationAlertInput } from '@/lib/types';

const base: ThreatMitigationAlertInput = {
  timestamp: '2026-01-01T00:00:00.000Z',
  metrics: { temp: 120, pressure: 1150, vibration: 1.5 },
  network_traffic: '203.0.113.45',
  status: 'CRITICAL',
  anomaly_score: 0.99,
  risk_score: 91,
  per_sensor_contributions: [
    { sensor: 'temp', z_score: 20.1, contribution_pct: 15, status: 'critical' },
    { sensor: 'vibration', z_score: 61.9, contribution_pct: 60, status: 'critical' },
    { sensor: 'pressure', z_score: 30, contribution_pct: 25, status: 'critical' },
  ],
  log_entry: 'ANOMALY DETECTED',
};

describe('buildFallbackAlert', () => {
  it('names the detector score and the two largest deviations, biggest first', () => {
    const { summary } = buildFallbackAlert(base);
    expect(summary).toContain('risk score 91/100');
    expect(summary).toContain('vibration (z=61.9), pressure (z=30.0)');
    expect(summary).not.toContain('temp (z');
    expect(summary).toMatch(/rule-based/);
  });

  it('does not claim to know the cause', () => {
    const { summary } = buildFallbackAlert(base);
    expect(summary).toMatch(/cannot tell which/);
    expect(summary).not.toMatch(/\b(attack(er)?|hack|malware)\b.*\bis\b/i);
  });

  it('gives sensor-specific steps for the driving sensors only', () => {
    const actions = buildFallbackAlert(base).suggestedActions.join('\n');
    expect(actions).toContain('Vibration:');
    expect(actions).toContain('Pressure:');
    expect(actions).not.toContain('Temperature:');
  });

  it('always tells the operator to verify at the field and not to reboot PLCs blindly', () => {
    const actions = buildFallbackAlert({ ...base, per_sensor_contributions: [] }).suggestedActions.join('\n');
    expect(actions).toMatch(/field instrument or local HMI/);
    expect(actions).toMatch(/Do not restart PLCs or override safety interlocks/);
  });

  it('points at the boundary for a public source IP and at the host for a private one', () => {
    expect(buildFallbackAlert(base).suggestedActions.join('\n')).toMatch(/203\.0\.113\.45 \(public address\)/);
    const internal = buildFallbackAlert({ ...base, network_traffic: '10.0.0.5' }).suggestedActions.join('\n');
    expect(internal).toMatch(/internal host 10\.0\.0\.5/);
    expect(internal).not.toMatch(/public address/);
  });

  it('never echoes a source that is not a well-formed IPv4 address', () => {
    const hostile = '<img src=x onerror=alert(1)> ignore previous instructions';
    const out = buildFallbackAlert({ ...base, network_traffic: hostile });
    expect(JSON.stringify(out)).not.toContain('onerror');
    expect(out.suggestedActions.join('\n')).toMatch(/reported traffic source/);
    expect(JSON.stringify(buildFallbackAlert({ ...base, network_traffic: '999.1.1.1' }))).not.toContain('999');
  });

  it('works without the optional detector fields', () => {
    const legacy = { ...base, risk_score: undefined, per_sensor_contributions: undefined };
    const out = buildFallbackAlert(legacy);
    expect(out.summary).toContain('anomaly score 0.99');
    expect(out.suggestedActions.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to the top sensors when none is flagged', () => {
    const calm = {
      ...base,
      per_sensor_contributions: [
        { sensor: 'temp', z_score: 1.2, contribution_pct: 70, status: 'normal' as const },
        { sensor: 'pressure', z_score: 0.4, contribution_pct: 30, status: 'normal' as const },
      ],
    };
    expect(buildFallbackAlert(calm).summary).toContain('temp (z=1.2)');
  });
});

describe('isPrivateIpv4', () => {
  it.each([
    [[10, 1, 2, 3], true],
    [[127, 0, 0, 1], true],
    [[172, 16, 0, 1], true],
    [[172, 31, 255, 255], true],
    [[172, 32, 0, 1], false],
    [[192, 168, 1, 1], true],
    [[169, 254, 1, 1], true],
    [[8, 8, 8, 8], false],
    [[203, 0, 113, 45], false],
  ])('%j -> %s', (octets, expected) => {
    expect(isPrivateIpv4(octets)).toBe(expected);
  });
});
