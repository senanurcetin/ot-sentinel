import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordedTelemetrySource } from '@/lib/recorded-telemetry';
import { loadVerifiedOfflineReplayInBrowser } from '@/lib/offline-replay-browser';

jest.mock('@/lib/offline-replay-browser', () => ({
  loadVerifiedOfflineReplayInBrowser: jest.fn(),
}));
const verifiedReplayMock = jest.mocked(loadVerifiedOfflineReplayInBrowser);

const digest = 'a'.repeat(64);
const recordingManifest = {
  schema: 'ot-sentinel/offline-three-sensor/v1',
  source_label: 'SYNTHETIC TEST',
  sha256: digest,
  row_count: 2,
  start_utc: '2026-10-16T10:00:00Z',
  end_utc: '2026-10-16T10:00:01Z',
  cadence_ms: 1000,
};

function makeReplay() {
  return new RecordedTelemetrySource([
    { timestamp: '2026-10-16T10:00:00Z', metrics: { temp: 50, pressure: 1010, vibration: 0.055 } },
    { timestamp: '2026-10-16T10:00:01Z', metrics: { temp: 130, pressure: 1010, vibration: 0.055 } },
  ]);
}

async function verifySyntheticRecording() {
  const raw = new File(['[]'], 'offline-recording.json', { type: 'application/json' });
  Object.defineProperty(raw, 'arrayBuffer', {
    value: async () => new Uint8Array([91, 93]).buffer,
  });
  const manifest = new File([JSON.stringify(recordingManifest)], 'manifest.json', { type: 'application/json' });
  Object.defineProperty(manifest, 'text', { value: async () => JSON.stringify(recordingManifest) });
  fireEvent.change(screen.getByLabelText('Recording JSON'), { target: { files: [raw] } });
  fireEvent.change(screen.getByLabelText('Manifest JSON'), { target: { files: [manifest] } });
  fireEvent.change(screen.getByLabelText(/Independently verified SHA-256/), { target: { value: digest } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and open replay' }));
  await screen.findByText('LOCAL HASH VERIFIED');
}

import OfflineReplayWorkbench from '@/components/offline-replay-workbench';

describe('OfflineReplayWorkbench', () => {
  afterEach(() => jest.resetAllMocks());

  it('starts with no trustworthy status and makes the privacy boundary explicit', () => {
    render(<OfflineReplayWorkbench />);
    expect(screen.getByRole('heading', { name: 'Local Telemetry Replay' })).toBeInTheDocument();
    expect(screen.getByText(/Files are processed in your browser only/)).toBeInTheDocument();
    expect(screen.getByLabelText('Recording JSON')).toBeInTheDocument();
    expect(screen.getByLabelText('Manifest JSON')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /BATADAL evaluation/ })).toHaveAttribute('href', '/case-study');
    expect(screen.queryByText('LOCAL HASH VERIFIED')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next recorded sample' })).not.toBeInTheDocument();
  });

  it('rejects a missing local file without claiming verification', async () => {
    render(<OfflineReplayWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify and open replay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a local recording and manifest');
    expect(screen.queryByText('LOCAL HASH VERIFIED')).not.toBeInTheDocument();
  });
  it('reviews every intervening batch row, clamps at EOF and preserves the inspected window', async () => {
    const replay = makeReplay();
    const next = jest.spyOn(replay, 'next');
    verifiedReplayMock.mockResolvedValueOnce(replay);
    render(<OfflineReplayWorkbench />);
    await verifySyntheticRecording();

    fireEvent.click(screen.getByRole('button', { name: 'Review next 10 samples' }));
    await waitFor(() => expect(next).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Historical detector verdict: CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('2 samples in view')).toBeInTheDocument();
    expect(screen.getByText('End of verified recording.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review next 10 samples' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review next 100 samples' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download reviewed JSON report' })).toBeEnabled();
  });

  it('re-verifies original bytes when restarting and clears reviewed history', async () => {
    verifiedReplayMock.mockResolvedValueOnce(makeReplay()).mockResolvedValueOnce(makeReplay());
    render(<OfflineReplayWorkbench />);
    await verifySyntheticRecording();

    fireEvent.click(screen.getByRole('button', { name: 'Review next 100 samples' }));
    expect(screen.getByText('2 samples in view')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restart from first sample' }));
    await waitFor(() => expect(verifiedReplayMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Verified and ready.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('2 samples in view')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download reviewed JSON report' })).toBeDisabled();
  });

});
