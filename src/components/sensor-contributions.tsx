import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SensorContribution } from '@/lib/types';

type SensorContributionsProps = {
  contributions: SensorContribution[];
  riskScore: number | null;
};

const STATUS_STYLES: Record<SensorContribution['status'], { bar: string; label: string }> = {
  normal: { bar: 'bg-emerald-500', label: 'text-emerald-500' },
  warning: { bar: 'bg-amber-500', label: 'text-amber-500' },
  critical: { bar: 'bg-rose-500', label: 'text-rose-500' },
};

/** Z-score at which a sensor's bar is full; anything beyond is clipped for display only. */
const BAR_FULL_Z = 6;

export default function SensorContributions({ contributions, riskScore }: SensorContributionsProps) {
  return (
    <Card className="shadow-sm" data-testid="sensor-contributions">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Why this score?</CardTitle>
        <CardDescription>
          Distance of each sensor from its attack-free baseline (z-score).
          {riskScore !== null && ` Current risk score: ${riskScore}/100.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for telemetry…</p>
        ) : (
          contributions.map((c) => {
            const styles = STATUS_STYLES[c.status];
            const width = Math.min(100, (c.z_score / BAR_FULL_Z) * 100);
            return (
              <div key={c.sensor} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium capitalize">{c.sensor}</span>
                  <span className={cn('font-mono text-xs', styles.label)}>
                    z = {c.z_score.toFixed(2)} · {c.contribution_pct.toFixed(0)}% · {c.status}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded bg-muted"
                  role="progressbar"
                  aria-label={`${c.sensor} deviation`}
                  aria-valuenow={Math.round(width)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cn('h-full rounded', styles.bar)} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
