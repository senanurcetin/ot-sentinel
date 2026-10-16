import type { Metadata } from 'next';
import OfflineReplayWorkbench from '@/components/offline-replay-workbench';

export const metadata: Metadata = {
  title: 'Local Telemetry Replay · OT-Sentinel',
  description: 'Verify and inspect local three-sensor historical recordings without uploading files.',
};

export default function OfflineReplayPage() {
  return <OfflineReplayWorkbench />;
}
