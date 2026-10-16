import { fireEvent, render, screen } from '@testing-library/react';
import OfflineReplayWorkbench from '@/components/offline-replay-workbench';

describe('OfflineReplayWorkbench', () => {
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
});
