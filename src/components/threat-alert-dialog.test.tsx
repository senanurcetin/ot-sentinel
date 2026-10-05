import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ThreatAlertDialog from '@/components/threat-alert-dialog';
import { generateThreatMitigationAlert } from '@/ai/flows/threat-mitigation-alert';
import type { ThreatMitigationAlertInput } from '@/lib/types';

jest.mock('@/ai/flows/threat-mitigation-alert', () => ({
  generateThreatMitigationAlert: jest.fn(),
}));
const mockedAlert = generateThreatMitigationAlert as jest.Mock;

const threat: ThreatMitigationAlertInput = {
  timestamp: '2026-01-01T00:00:00.000Z',
  metrics: { temp: 120, pressure: 1150, vibration: 1.5 },
  network_traffic: '203.0.113.45',
  status: 'CRITICAL',
  anomaly_score: 0.99,
  risk_score: 90,
  log_entry: 'ANOMALY DETECTED',
};

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true, status: 202 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  mockedAlert.mockReset();
  mockedAlert.mockResolvedValue({ summary: 'Vibration spike', suggestedActions: ['Isolate pump', 'Check logs'], source: 'ai' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('ThreatAlertDialog', () => {
  it('renders the AI summary and suggested actions', async () => {
    render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    expect(await screen.findByText('Vibration spike')).toBeInTheDocument();
    expect(screen.getByText('Isolate pump')).toBeInTheDocument();
    expect(screen.getByText('Check logs')).toBeInTheDocument();
  });

  it('does not show the fallback notice for an AI answer', async () => {
    render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    await screen.findByText('Vibration spike');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('labels server-side fallback guidance as rule-based', async () => {
    mockedAlert.mockResolvedValue({ summary: 'Rule summary', suggestedActions: ['Check gauge'], source: 'fallback' });
    render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    expect(await screen.findByText('Rule summary')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('AI explanation unavailable');
  });

  it('builds the same rule-based guidance locally when the server action itself fails', async () => {
    mockedAlert.mockRejectedValue(new Error('server action unreachable'));
    render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    expect(await screen.findByText(/rule-based assessment/)).toBeInTheDocument();
    expect(screen.getByText(/Do not restart PLCs/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('AI explanation unavailable');
  });

  it.each([
    ['Mark as false alarm', 'false_alarm'],
    ['Confirm threat & close', 'confirmed_threat'],
  ])('"%s" posts the %s verdict for this alert and closes the dialog', async (label, verdict) => {
    const onOpenChange = jest.fn();
    render(<ThreatAlertDialog open onOpenChange={onOpenChange} threatData={threat} />);
    await screen.findByText('Vibration spike');

    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ timestamp: threat.timestamp, verdict });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('still closes when the feedback request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const onOpenChange = jest.fn();
    render(<ThreatAlertDialog open onOpenChange={onOpenChange} threatData={threat} />);
    await screen.findByText('Vibration spike');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as false alarm' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not call the AI while closed', () => {
    render(<ThreatAlertDialog open={false} onOpenChange={jest.fn()} threatData={threat} />);
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it('ignores a response that arrives after the dialog was closed', async () => {
    let resolve!: (v: unknown) => void;
    mockedAlert.mockReturnValue(new Promise((r) => (resolve = r)));
    const { rerender } = render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    rerender(<ThreatAlertDialog open={false} onOpenChange={jest.fn()} threatData={threat} />);
    await act(async () => resolve({ summary: 'Late answer', suggestedActions: [] }));
    expect(screen.queryByText('Late answer')).not.toBeInTheDocument();
  });

  it('requests a fresh explanation when reopened for a new alert', async () => {
    const { rerender } = render(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={threat} />);
    await screen.findByText('Vibration spike');
    rerender(<ThreatAlertDialog open={false} onOpenChange={jest.fn()} threatData={threat} />);
    mockedAlert.mockResolvedValue({ summary: 'Second alert', suggestedActions: [] });
    rerender(<ThreatAlertDialog open onOpenChange={jest.fn()} threatData={{ ...threat, timestamp: 'later' }} />);
    expect(await screen.findByText('Second alert')).toBeInTheDocument();
    expect(mockedAlert).toHaveBeenCalledTimes(2);
  });
});
