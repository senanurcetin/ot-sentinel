'use client';

import { useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  HISTORICAL_SIGNAL_GROUPS, getHistoricalSource, historicalAttackPoints,
  historicalDetectorEvidence, historicalDetectorOptions, historicalSignalOptions,
  signalGroup, signalUnit, type HistoricalDataset,
  type HistoricalSignalGroup,
} from '@/lib/batadal-history';

const chartConfig = {
  value: { label: 'Published hourly measurement', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export function BatadalHistoricalWorkbench({ dataset = 'dataset04' }: { dataset?: HistoricalDataset }) {
  const source = getHistoricalSource(dataset);
  const isTest = dataset === 'test';
  const year = isTest ? '2017' : '2016';
  const [attackId, setAttackId] = useState(isTest ? 8 : 1);
  const [group, setGroup] = useState<HistoricalSignalGroup>('all');
  const [signal, setSignal] = useState(isTest ? 'L_T3' : 'L_T7');
  const [detector, setDetector] = useState('zscore_max');
  const options = historicalSignalOptions(group);
  const selectedSignal = options.includes(signal) ? signal : options[0];
  const availableDetectors = historicalDetectorOptions(dataset);
  const selectedDetector = availableDetectors.some(x => x.key === detector) ? detector : 'zscore_max';
  const evidence = historicalDetectorEvidence(dataset, attackId, selectedDetector);
  const interval = source.attack_intervals.find(a => a.id === attackId)!;
  const rows = historicalAttackPoints(attackId, selectedSignal, dataset);
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
        <h1 className="text-3xl font-semibold">Verified {year} hourly sensor history</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Genuine BATADAL {isTest ? 'unseen 2017 test ZIP' : '2016 Dataset 04'} measurements
          from the publisher source, confirmed against the independently pinned SHA-256. Seven recorded
          attack windows include twelve unmodified hours on either side.
          <strong> No interpolation, simulated telemetry or new detector inference.</strong>
        </p>
      </header>
      <section aria-label="Data integrity and provenance" className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Original dataset</p>
            <p className="font-semibold">{year} / BATADAL {isTest ? 'unseen test ZIP' : 'dataset04'}</p></div>
          <div><p className="text-xs text-muted-foreground">Available measured signals</p>
            <p className="font-semibold">{source.feature_names.length} real channels</p></div>
          <div><p className="text-xs text-muted-foreground">Source-recorded samples in view</p>
            <p className="font-semibold">{rows.length} contiguous hourly rows</p></div>
        </div>
        <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
          Original {isTest ? 'ZIP' : 'CSV'} SHA-256: {source.provenance.source_sha256}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Timestamp timezone is unspecified in the original source; displayed clock
          values are source-local, not asserted UTC. Measurements come from a
          simulated C-Town network, not a live water plant.
        </p>
      </section>
      <section aria-label="Historical chart controls" className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <label className="space-y-2 text-sm font-medium">
          <span>Published attack interval</span>
          <select aria-label="Published attack interval" value={attackId}
            onChange={e => setAttackId(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background p-2">
            {source.attack_intervals.map(a =>
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
          <span>Retrospective detector</span>
          <select aria-label="Retrospective detector" value={selectedDetector}
            onChange={e => setDetector(e.target.value)}
            className="w-full rounded-md border border-border bg-background p-2">
            {availableDetectors.map(option => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
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
              {evidence?.firstAlarmSourceLocal && (
                <ReferenceLine x={evidence.firstAlarmSourceLocal}
                  stroke="hsl(var(--chart-4))" strokeDasharray="5 3" />
              )}
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
      <section className="space-y-3 rounded-xl border border-border bg-card p-4"
        aria-label="Retrospective model evidence">
        <h2 className="text-lg font-semibold">Published detector result (retrospective)</h2>
        <p className="text-sm text-muted-foreground">
          The selected benchmark model&apos;s **historical first alarm** is shown as a
          dashed line; this comes from the independently evaluated summary,
          not from fitting or recomputing a risk score using the displayed sensors.
        </p>
        {evidence && (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">First benchmark alarm</p>
              <p className="font-semibold">{evidence.firstAlarmDelayHours === null
                ? 'Not detected in published interval'
                : `${evidence.firstAlarmDelayHours} h after published attack start`}</p>
              {evidence.firstAlarmSourceLocal && (
                <p className="mt-1 font-mono text-xs">{evidence.firstAlarmSourceLocal} (source-local)</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">False alarms per day</p>
              <p className="font-semibold">{evidence.falseAlarmsPerDay === null
                ? 'Not reported' : evidence.falseAlarmsPerDay.toFixed(3)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Events expected by false alarms alone</p>
              <p className="font-semibold">{evidence.expectedEventsFromFalseAlarms === null
                ? 'Not reported' : evidence.expectedEventsFromFalseAlarms.toFixed(2)}</p>
            </div>
          </div>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          The reported first-alarm delay is descriptive and retrospective; the source
          contains no hourly detector-score trace. Detection of a long attack can
          occur by chance from false alarms. No alarm is treated as validated
          physical-plant cyber intrusion.
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
      <p className="text-xs leading-6 text-muted-foreground">
        Source: BATADAL / Taormina et al. (2018), C-Town simulation.
        Licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer"
          className="text-cyan-600 hover:underline">CC BY 4.0</a>.
        Adapted by selecting seven published attack windows with 12 hours of original
        surrounding measurements and reformatting source-local timestamps.
        <a href={isTest
            ? "https://github.com/scy-phy/www.batadal.net/blob/master/data/BATADAL_test_dataset.zip"
            : "https://github.com/scy-phy/www.batadal.net/blob/master/data/BATADAL_dataset04.csv"}
          rel="noreferrer" className="ml-1 text-cyan-600 hover:underline">Publisher source</a>.
      </p>
      <aside role="note" aria-label="Limitations of verified history"
        className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        {isTest ? (
          <>These are genuine **2017 unseen test-period measurements**. Ground-truth
            interval labels come from the separately published BATADAL attack table,
            not from the original unlabelled test ZIP. The shaded region is
            not an alarm or model output. No training, threshold fitting, or new
            model evaluation was performed on the unseen test measurements.</>
        ) : (
          <>These are genuine **2016 secondary/training-period measurements**,
            not the 2017 holdout. The verified 2017 original test measurements
            are separately available at /batadal-test-history and must not be
            confused with the 2016 source.</>
        )}
        {' '}No live plant connection, security certification or new ML inference.
      </aside>
    </div>
  );
}
