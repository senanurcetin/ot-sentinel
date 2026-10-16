'use client';

import { useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  HISTORICAL_SOURCE, HISTORICAL_SIGNAL_GROUPS, historicalAttackPoints,
  historicalSignalOptions, signalGroup, signalUnit, type HistoricalSignalGroup,
} from '@/lib/batadal-history';

const chartConfig = {
  value: { label: 'Published hourly measurement', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export function BatadalHistoricalWorkbench() {
  const [attackId, setAttackId] = useState(1);
  const [group, setGroup] = useState<HistoricalSignalGroup>('all');
  const [signal, setSignal] = useState('L_T7');
  const options = historicalSignalOptions(group);
  const selectedSignal = options.includes(signal) ? signal : options[0];
  const interval = HISTORICAL_SOURCE.attack_intervals.find(a => a.id === attackId)!;
  const rows = historicalAttackPoints(attackId, selectedSignal);
  const attackRows = rows.filter(r => r.publishedAttackInterval);
  const min = Math.min(...rows.map(r => r.value));
  const max = Math.max(...rows.map(r => r.value));
  const unit = signalUnit(selectedSignal);
  const isState = signalGroup(selectedSignal) === 'states';
  const dateLabel = (iso: string) => iso.slice(5, 16).replace('T', ' ');
  return (
    <div className="space-y-6" data-testid="batadal-historical-workbench">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-500">
          NEXUS / BATADAL / Source-measured history
        </p>
        <h1 className="text-3xl font-semibold">Verified 2016 hourly sensor history</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Genuine BATADAL Dataset 04 measurements from the publisher source,
          confirmed against the independently pinned SHA-256. Seven recorded
          attack windows include twelve unmodified hours on either side.
          <strong> No interpolation, simulated telemetry or new detector inference.</strong>
        </p>
      </header>
      <section aria-label="Data integrity and provenance" className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Original dataset</p>
            <p className="font-semibold">2016 / BATADAL dataset04</p></div>
          <div><p className="text-xs text-muted-foreground">Available measured signals</p>
            <p className="font-semibold">{HISTORICAL_SOURCE.feature_names.length} real channels</p></div>
          <div><p className="text-xs text-muted-foreground">Source-recorded samples in view</p>
            <p className="font-semibold">{rows.length} contiguous hourly rows</p></div>
        </div>
        <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
          Official CSV SHA-256: {HISTORICAL_SOURCE.provenance.source_sha256}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Timestamp timezone is unspecified in the original source; displayed clock
          values are source-local, not asserted UTC. Measurements come from a
          simulated C-Town network, not a live water plant.
        </p>
      </section>
      <section aria-label="Historical chart controls" className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span>Published attack interval</span>
          <select aria-label="Published attack interval" value={attackId}
            onChange={e => setAttackId(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background p-2">
            {HISTORICAL_SOURCE.attack_intervals.map(a =>
              <option key={a.id} value={a.id}>Attack #{a.id} ({a.duration_hours} h)</option>
            )}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Measurement category</span>
          <select aria-label="Measurement category" value={group}
            onChange={e => setGroup(e.target.value as HistoricalSignalGroup)}
            className="w-full rounded-md border border-border bg-background p-2">
            {HISTORICAL_SIGNAL_GROUPS.map(g =>
              <option key={g.value} value={g.value}>{g.label}</option>
            )}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Recorded measurement</span>
          <select aria-label="Recorded measurement" value={selectedSignal}
            onChange={e => setSignal(e.target.value)}
            className="w-full rounded-md border border-border bg-background p-2">
            {options.map(name => <option key={name} value={name}>
              {name} ({signalUnit(name)})
            </option>)}
          </select>
        </label>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6"
        aria-label="Real historical measurement chart">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Source measurements: {selectedSignal}</h2>
            <p className="text-xs text-muted-foreground">
              Source-local hourly time / {unit} · shaded region: published attack interval
            </p>
          </div>
          <span className="rounded-md border border-border px-3 py-1 text-xs">
            {attackRows.length} / {rows.length} in published attack interval
          </span>
        </div>
        <div className="h-80 min-h-0 w-full">
          <ChartContainer className="h-full w-full !aspect-auto" config={chartConfig}>
            <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 6, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="timestamp" minTickGap={20} tickLine={false}
                axisLine={false} tickFormatter={dateLabel}/>
              <YAxis width={62} tickLine={false} axisLine={false}
                domain={isState ? [-0.1, 1.1] : ['auto', 'auto']}/>
              <ReferenceArea x1={interval.start} x2={interval.end}
                fill="hsl(var(--chart-1))" fillOpacity={0.12} strokeOpacity={0} />
              <ChartTooltip content={<ChartTooltipContent indicator="line"/>}/>
              <Line dataKey="value" type="linear" dot={false}
                stroke="var(--color-value)" strokeWidth={2}
                isAnimationActive={false} connectNulls={false}/>
            </LineChart>
          </ChartContainer>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Measured minimum</p>
            <p className="font-semibold tabular-nums">{min.toFixed(2)} {unit}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Measured maximum</p>
            <p className="font-semibold tabular-nums">{max.toFixed(2)} {unit}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Published attack duration</p>
            <p className="font-semibold tabular-nums">{interval.duration_hours} hours</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          An attack annotation is ground-truth metadata, not a detector prediction.
          Any apparent signal behavior must be interpreted alongside false alarms
          and source documentation.
        </p>
      </section>
      <section className="space-y-2 rounded-xl border border-border bg-card p-4"
        aria-label="Hourly recorded source rows">
        <h2 className="text-lg font-semibold">Underlying measured rows (selected signal)</h2>
        <p className="text-xs text-muted-foreground">
          First 15 unmodified source rows in the selected window; chart includes all {rows.length}.
        </p>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-border">
              <th className="p-2">Source timestamp</th>
              <th className="p-2">Measured value ({unit})</th>
              <th className="p-2">Published attack interval</th>
            </tr></thead>
            <tbody>{rows.slice(0, 15).map(r =>
              <tr key={r.timestamp} className="border-b border-border/50">
                <td className="p-2 font-mono">{r.timestamp}</td>
                <td className="p-2 tabular-nums">{r.value}</td>
                <td className="p-2">{r.publishedAttackInterval ? 'Within interval' : 'Outside interval'}</td>
              </tr>
            )}</tbody>
          </table>
        </div>
      </section>
      <aside role="note" aria-label="Limitations of verified history"
        className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        These are **2016 secondary/training-period measurements**, not the untouched
        2017 test set. The 2017 original ZIP has not been independently retrieved
        and verified for this feature. Historical charting is restricted to genuine
        2016 attack windows. It does not claim a live plant connection, security
        certification or a new ML evaluation.
      </aside>
    </div>
  );
}
