import type { Metadata } from 'next';
import Link from 'next/link';
import { BatadalHistoricalWorkbench } from '@/components/batadal-historical-workbench';

export const metadata: Metadata = {
  title: 'Verified BATADAL hourly history · OT-Sentinel',
  description: 'Genuine publisher SHA-256-verified 2016 BATADAL hourly 43-channel attack windows. Not live plant telemetry.',
};

export default function VerifiedBatadalHistoryPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Research navigation" className="flex flex-wrap gap-4 text-sm">
        <Link className="text-cyan-600 hover:underline" href="/batadal-explorer">← Benchmark evidence</Link>
        <Link className="text-cyan-600 hover:underline" href="/case-study">Detector evaluation</Link>
      </nav>
      <BatadalHistoricalWorkbench />
    </main>
  );
}
