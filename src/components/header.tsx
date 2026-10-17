'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart2 } from 'lucide-react';
import Link from 'next/link';

type HeaderProps = {
  isAttackMode: boolean;
  onAttackModeChange: (checked: boolean) => void;
  onShowReport: () => void;
};

export default function Header({ isAttackMode, onAttackModeChange, onShowReport }: HeaderProps) {
  return (
    <header className="nexus-masthead sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 shadow-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="nexus-header-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Image src="/nexus-x.svg" width={36} height={36} alt="" aria-hidden="true" unoptimized />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Image src="/nexus-wordmark.svg" width={108} height={32} alt="NEXUS" unoptimized className="h-5 w-auto self-start" />
          <h1 className="nexus-product text-lg leading-none text-foreground sm:text-xl">OT-Sentinel</h1>
          <span className="nexus-demo-disclaimer">Synthetic telemetry · no live PLC connection</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <nav aria-label="Demo and evidence navigation" className="nexus-evidence-nav flex flex-wrap items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/case-study">Case study</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/offline-replay">Offline replay</Link>
          </Button>
        </nav>
        <Button variant="outline" size="sm" onClick={onShowReport}>
          <BarChart2 className="mr-2 h-4 w-4" />
          View Report
        </Button>
        <div className="flex items-center space-x-2">
          <Switch id="attack-mode" checked={isAttackMode} onCheckedChange={onAttackModeChange} aria-label="Simulate Attack" />
          <Label htmlFor="attack-mode" className={`font-medium ${isAttackMode ? 'text-rose-400' : 'text-muted-foreground'}`}>Simulate Attack</Label>
        </div>
      </div>
    </header>
  );
}
