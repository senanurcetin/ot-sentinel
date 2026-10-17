'use client';

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
      <div className="flex items-center gap-3">
        <span className="nexus-logo-x" role="img" aria-label="NEXUS X mark" />
        <div className="flex flex-col gap-1">
          <span className="nexus-logo-wordmark" role="img" aria-label="NEXUS" />
          <h1 className="nexus-product text-lg leading-none text-foreground sm:text-xl">OT-Sentinel</h1>
          <span className="nexus-demo-disclaimer">Synthetic telemetry · no live PLC connection</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Button asChild variant="ghost" size="sm" className="inline-flex">
          <Link href="/case-study">Case study</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="inline-flex">
          <Link href="/offline-replay">Offline replay</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onShowReport}>
          <BarChart2 className="mr-2 h-4 w-4" />
          View Report
        </Button>
        <div className="flex items-center space-x-2">
          <Switch
            id="attack-mode"
            checked={isAttackMode}
            onCheckedChange={onAttackModeChange}
            aria-label="Simulate Attack"
          />
          <Label
            htmlFor="attack-mode"
            className={`font-medium ${
              isAttackMode ? 'text-rose-500' : 'text-muted-foreground'
            }`}
          >
            Simulate Attack
          </Label>
        </div>
      </div>
    </header>
  );
}
