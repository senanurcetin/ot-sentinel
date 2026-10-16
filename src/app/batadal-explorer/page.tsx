import type { Metadata } from 'next';
import Link from 'next/link';
import { BatadalEvidenceExplorer } from '@/components/batadal-evidence-explorer';

export const metadata: Metadata = {
  title: 'BATADAL evidence explorer · OT-Sentinel',
  description: 'Real offline BATADAL 43-signal inventory, documented attacks and benchmark detector evidence; no live plant readings.',
};

export default function BatadalExplorerPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Benchmark navigation" className="flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-cyan-600 underline-offset-4 hover:underline">
          ← Synthetic dashboard
        </Link>
        <Link href="/case-study" className="text-cyan-600 underline-offset-4 hover:underline">
          Offline benchmark case study
        </Link>
      </nav>
      <BatadalEvidenceExplorer />
    </main>
  );
}
