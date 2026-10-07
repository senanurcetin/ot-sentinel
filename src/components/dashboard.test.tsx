import { act, fireEvent, render, screen } from '@testing-library/react';
import Dashboard from '@/components/dashboard';
import { generateThreatMitigationAlert } from '@/ai/flows/threat-mitigation-alert';
import type { Metrics } from '@/lib/types';

jest.mock('@/ai/flows/threat-mitigation-alert', () => ({
  generateThreatMitigationAlert: jest.fn(),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockedAlert = generateThreatMitigationAlert as jest.Mock;

let tick = 0;
const sample = (over: Partial<Metrics> = {}): Metrics => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  metrics: { temp: 50, pressure: 1010, vibration: 0.05 },
  network_traffic: '10.0.0.5',
  traffic_volume: 100,
  status: 'SECURE',
  anomaly_score: 0.05,
  risk_score: 12,
  per_sensor_contributions: [
    { sensor: 'temp', z_score: 0.5, contribution_pct: 60, status: 'normal' },
    { sensor: 'pressure', z_score: 0.3, contribution_pct: 40, status: 'normal' },
  ],
  log_entry: 'Status check OK',
  ...over,
});

const critical = (): Metrics =>
  sample({
    status: 'CRITICAL',
    risk_score: 88,
    anomaly_score: 0.99,
    network_traffic: '203.0.113.45',
    metrics: { temp: 120, pressure: 1150, vibration: 1.5 },
    per_sensor_contributions: [
      { sensor: 'vibration', z_score: 60, contribution_pct: 70, status: 'critical' },
      { sensor: 'temp', z_score: 20, contribution_pct: 30, status: 'critical' },
    ],
    log_entry: 'ANOMALY DETECTED',
  });

/** Respond to GET /api/metrics with `next(attack)`, and to POST /api/feedback with 202. */
function mockFetch(next: (attack: boolean) => Metrics) {
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return { ok: true, status: 202, json: async () => ({}) };
    const attack = new URL(url, 'http://localhost').searchParams.get('attack') === 'true';
    return { ok: true, status: 200, json: async () => next(attack) };
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/**
 * Advance fake time one second at a time, each in its own `act`. React batches state updates until
 * `act` exits, so a single long `act` would hide timer-driven state (e.g. the alert cooldown) from
 * the polling callback that reads it through refs.
 */
const advance = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(Math.min(1000, ms - elapsed));
    });
  }
};

const metricsCalls = (fn: jest.Mock) =>
  fn.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith('/api/metrics'));

beforeEach(() => {
  jest.useFakeTimers();
  tick = 0;
  mockToast.mockClear();
  mockedAlert.mockReset();
  mockedAlert.mockResolvedValue({ summary: 'Pump vibration is far outside baseline.', suggestedActions: ['Isolate the pump'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // recharts: zero-size container in jsdom
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Dashboard', () => {
  it('polls /api/metrics every second and shows the detector risk score', async () => {
    const fetchMock = mockFetch(() => sample());
    render(<Dashboard />);
    expect(screen.getByText('Risk Score')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();

    await advance(1000);
    expect(metricsCalls(fetchMock)).toEqual(['/api/metrics?attack=false']);
    expect(screen.getByText('12/100')).toBeInTheDocument();
    expect(screen.getAllByText('SECURE').length).toBeGreaterThan(0);

    await advance(2000);
    expect(metricsCalls(fetchMock)).toHaveLength(3);
  });

  it('shows the per-sensor explanation for the current sample', async () => {
    mockFetch(() => sample());
    render(<Dashboard />);
    await advance(1000);
    expect(screen.getByText(/Current risk score: 12\/100/)).toBeInTheDocument();
    expect(screen.getByText(/z = 0\.50/)).toBeInTheDocument();
  });

  it('switching on attack simulation toasts and requests attack data', async () => {
    const fetchMock = mockFetch((attack) => (attack ? critical() : sample()));
    render(<Dashboard />);
    await advance(1000);

    fireEvent.click(screen.getByRole('switch', { name: 'Simulate Attack' }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Attack Simulation Enabled', variant: 'destructive' })
    );
    await advance(1000);
    expect(metricsCalls(fetchMock).at(-1)).toBe('/api/metrics?attack=true');
  });

  it('opens the alert for a CRITICAL sample and sends the detector verdict to the AI', async () => {
    mockFetch(() => critical());
    render(<Dashboard />);
    await advance(1000);

    expect(screen.getByText('CRITICAL THREAT DETECTED')).toBeInTheDocument();
    expect(screen.getByText('Pump vibration is far outside baseline.')).toBeInTheDocument();
    expect(mockedAlert).toHaveBeenCalledTimes(1);
    expect(mockedAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'CRITICAL',
        risk_score: 88,
        per_sensor_contributions: expect.arrayContaining([
          expect.objectContaining({ sensor: 'vibration', status: 'critical' }),
        ]),
      })
    );
  });

  it('asks the AI once per alert even though telemetry keeps updating while it is pending', async () => {
    mockFetch(() => critical());
    mockedAlert.mockReturnValue(new Promise(() => {})); // never resolves: a slow model
    render(<Dashboard />);
    await advance(4000); // four more telemetry samples arrive while the dialog waits

    expect(mockedAlert).toHaveBeenCalledTimes(1);
  });

  it('counts the threat, honours the 5 s cooldown after dismissal, then alerts again', async () => {
    const fetchMock = mockFetch(() => critical());
    render(<Dashboard />);
    await advance(1000);
    expect(screen.getByText('Critical events in this session').previousSibling).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm threat & close' }));
    // verdict is sent to the feedback endpoint
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/feedback');
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ verdict: 'confirmed_threat' });

    await advance(4000); // 4 s after dismissal: still within the 5 s cooldown, telemetry stays CRITICAL
    expect(screen.queryByText('CRITICAL THREAT DETECTED')).not.toBeInTheDocument();

    await advance(2000); // 6 s after dismissal: cooldown over, next sample re-alerts
    expect(screen.getByText('CRITICAL THREAT DETECTED')).toBeInTheDocument();
    expect(screen.getByText('Critical events in this session').previousSibling).toHaveTextContent('2');
  });

  it('resets the threat counter when attack simulation is switched off', async () => {
    mockFetch((attack) => (attack ? critical() : sample()));
    render(<Dashboard />);
    await advance(1000);
    fireEvent.click(screen.getByRole('switch', { name: 'Simulate Attack' }));
    await advance(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as false alarm' }));
    expect(screen.getByText('Critical events in this session').previousSibling).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('switch', { name: 'Simulate Attack' }));
    expect(screen.getByText('Critical events in this session').previousSibling).toHaveTextContent('0');
  });

  it('keeps at most 100 audit log entries', async () => {
    mockFetch(() => sample());
    render(<Dashboard />);
    await advance(105_000);
    expect(screen.getByText('Showing last 100 events')).toBeInTheDocument();
  });

  it('survives a failing metrics request and recovers on the next tick', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      return { ok: true, json: async () => sample() };
    }) as unknown as typeof fetch;
    render(<Dashboard />);
    await advance(1000);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    await advance(1000);
    expect(screen.getByText('12/100')).toBeInTheDocument();
  });
});
