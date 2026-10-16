'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { Metrics } from '@/lib/types';

/** Only samples the operator has actually stepped through appear in these plots. */
export const MAX_OFFLINE_TREND_SAMPLES = 120;

const chartConfig = {
  temp: { label: 'Temperature (°C)', color: 'hsl(var(--chart-2))' },
  risk: { label: 'Demo detector risk', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export default function OfflineReplayTrends({ samples }: { samples: readonly Metrics[] }) {
  if (samples.length === 0) {
    return <p className="text-sm text-muted-foreground">No historical samples reviewed yet.</p>;
  }

  const points = samples.map((sample) => ({
    timestamp: sample.timestamp,
    temp: sample.metrics.temp,
    risk: sample.risk_score,
  }));
  const highest = Math.max(...samples.map((sample) => sample.risk_score));
  const critical = samples.filter((sample) => sample.status === 'CRITICAL').length;
  const utcTime = (time: string) => time.slice(11, 19);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-label="Historical sample trend charts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">03 / Historical sample trends</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Only locally verified, already-reviewed samples. Last {MAX_OFFLINE_TREND_SAMPLES} maximum.
            No live data, network measurements, interpolation or future recording samples.
          </p>
        </div>
        <span role="status" className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground">
          {samples.length} samples in view
        </span>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <dt className="text-muted-foreground">Highest displayed risk</dt>
          <dd className="mt-1 text-xl font-semibold">{highest}/100</dd>
        </div>
        <div className="rounded-md border border-border p-3">
          <dt className="text-muted-foreground">Critical samples in view</dt>
          <dd className="mt-1 text-xl font-semibold">{critical} / {samples.length}</dd>
        </div>
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-60 min-h-0 flex-col">
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Temperature (°C) · recorded UTC</h4>
          <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1 !aspect-auto">
            <LineChart data={points} margin={{ top: 6, right: 10, left: 3, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickLine={false} axisLine={false}
                tickMargin={8} tickFormatter={utcTime} minTickGap={18} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8}
                domain={['dataMin - 5', 'dataMax + 5']} width={44} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line dataKey="temp" type="linear" stroke="var(--color-temp)"
                strokeWidth={2} dot={points.length < 4} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        </div>
        <div className="flex h-60 min-h-0 flex-col">
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Demo risk score (0–100) · recorded UTC</h4>
          <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1 !aspect-auto">
            <LineChart data={points} margin={{ top: 6, right: 10, left: 3, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickLine={false} axisLine={false}
                tickMargin={8} tickFormatter={utcTime} minTickGap={18} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 100]} width={40} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line dataKey="risk" type="linear" stroke="var(--color-risk)"
                strokeWidth={2} dot={points.length < 4} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </section>
  );
}
