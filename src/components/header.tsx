'use client';

import { LogoIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart2 } from 'lucide-react';

type HeaderProps = {
  isAttackMode: boolean;
  onAttackModeChange: (checked: boolean) => void;
  onShowReport: () => void;
};

export default function Header({ isAttackMode, onAttackModeChange, onShowReport }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <LogoIcon className="h-7 w-7 text-primary" />
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          OT-Sentinel
        </h1>
      </div>
      <div className="flex items-center gap-4">
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
