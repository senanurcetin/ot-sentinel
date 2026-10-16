'use client';

import { useState } from 'react';
import {
  BATADAL_GROUPS, BATADAL_PROVENANCE, attackEvidence, benchmarkDetectorOptions,
  detectorOverview, featureGroup, signalInventory, type BatadalGroup, type BatadalSet,
} from '@/lib/batadal-explorer';
import { results } from '@/lib/case-study';

const pct = (v: number | null) => v == null ? 'n/a' : `${(100 * v).toFixed(1)}%`;
const decimal = (v: number | null, digits = 2) => v == null ? 'n/a' : v.toFixed(digits);

export function BatadalEvidenceExplorer() {
  const [setName, setSetName] = useState<BatadalSet>('test');
  const [detector, setDetector] = useState('zscore_max');
  const [group, setGroup] = useState<BatadalGroup>('all');
  const evaluation = results.evaluations[setName];
  const options = benchmarkDetectorOptions(setName);
  const selectedDetector = evaluation.detectors[detector] ? detector : 'zscore_max';
  const overview = detectorOverview(evaluation, selectedDetector);
  const inventory = signalInventory(setName, group);
  const attacks = attackEvidence(setName, selectedDetector);
  const topDrift = results.drift[setName];
  const knownDrift = inventory.filter(x => x.reportedTopDriftFraction !== null);
  const groupTitle = Object.fromEntries(BATADAL_GROUPS.map(g => [g.id, g.label]));

  return (
    <div className="space-y-7" data-testid="batadal-evidence-explorer">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-500">
          NEXUS / Research intelligence / Offline benchmark
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">BATADAL signal evidence explorer</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Explore the published 43-signal inventory, documented attack targets,
          detector outcomes and measured benchmark drift. This is a <strong>read-only
          view of offline evaluation results</strong>, not a live SCADA feed or a
          replay of hourly raw measurements. A separately verified 2016 history
          viewer at /batadal-history contains measured hourly attack windows.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Benchmark provenance">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Evaluated signals</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{BATADAL_PROVENANCE.signals}</p>
          <p className="text-xs text-muted-foreground">BATADAL water distribution benchmark</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Normal reference rows</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{BATADAL_PROVENANCE.referenceRows.toLocaleString('en-US')}</p>
          <p className="text-xs text-muted-foreground">Reference data; not live sensor samples</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Evaluation protocol</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">v{BATADAL_PROVENANCE.protocolVersion}</p>
          <p className="text-xs text-muted-foreground">Attack-free threshold calibration</p>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Evaluation selectors">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-medium">
            <span>Evaluation set</span>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2"
              aria-label="Evaluation set" value={setName} onChange={e => {
                const next = e.target.value as BatadalSet;
                setSetName(next);
                if (!results.evaluations[next].detectors[detector]) setDetector('zscore_max');
              }}>
              <option value="test">2017 unseen test — attacks 8–14</option>
              <option value="train">2016 secondary — attacks 1–7</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Evaluated detector</span>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2"
              aria-label="Evaluated detector" value={selectedDetector} onChange={e => setDetector(e.target.value)}>
              {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Signal category</span>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2"
              aria-label="Signal category" value={group} onChange={e => setGroup(e.target.value as BatadalGroup)}>
              {BATADAL_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The supervised reference was trained on 2016 attack labels and is
          therefore intentionally excluded from that same evaluation set.
        </p>
      </section>
      {overview && <section aria-label="Detector evidence" className="space-y-3">
        <h2 className="text-lg font-semibold">Measured detector results</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'PR-AUC', value: decimal(overview.prAuc, 3) },
            { label: 'Hour-level precision', value: pct(overview.precision) },
            { label: 'Attack-hour recall', value: pct(overview.recall) },
            { label: 'False-alarm hours, attack-free', value: pct(overview.falseAlarmHourFraction) },
          ].map(m => <div key={m.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{m.value}</p>
          </div>)}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {overview.eventsDetected}/{overview.eventsTotal} attacks contain at least one alarm;
          false alarms alone predict about {decimal(overview.expectedEventsByChance, 1)} such
          events. A high event-detection count <strong>does not establish</strong> good
          attack discrimination. Measured false alarm segments/day:{' '}
          {decimal(overview.falseAlarmsPerDay)}.
        </p>
      </section>}
      <section className="space-y-3" aria-label="Published attack descriptions">
        <h2 className="text-lg font-semibold">Attack-level evidence — {setName === 'test' ? '2017 holdout' : '2016 secondary'}</h2>
        <p className="text-sm text-muted-foreground">
          Targeted signals below come from published attack descriptions, not from
          machine-learned feature importance or observed hourly sensor traces.
          Detection delay is measured from the published attack start.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Attack</th><th className="p-3">Duration</th>
                <th className="p-3">Detector result</th><th className="p-3">First alarm</th>
                <th className="p-3">Description-affected signals</th></tr>
            </thead>
            <tbody>
              {attacks.map(a => <tr key={a.id} className="border-t border-border align-top">
                <td className="p-3 font-semibold">#{a.id}</td>
                <td className="p-3 tabular-nums">{a.durationHours} h</td>
                <td className="p-3">{a.detected ? 'Alarm observed' : 'Not detected'}</td>
                <td className="p-3 tabular-nums">{a.detectionDelayHours === null ? 'n/a' : `${a.detectionDelayHours} h`}</td>
                <td className="p-3 font-mono text-xs">{a.descriptionAffectedSignals.join(', ')}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3" aria-label="Signal inventory">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">43-signal inventory and distribution shift</h2>
          <span className="text-xs text-muted-foreground">{inventory.length} of {BATADAL_PROVENANCE.signals} signals shown</span>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          On {topDrift.normal_hours.toLocaleString('en-US')} attack-free evaluation
          hours, {(topDrift.share_of_hours_with_any_feature_outside_reference_range * 100).toFixed(1)}%
          {' '}have at least one feature outside the reference min–max envelope.
          Individual drift values are published for only the top ranked signals:
          unlisted values are <strong>not reported, not zero</strong>.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Signal</th><th className="p-3">Category</th>
                <th className="p-3">Normal reference</th><th className="p-3">Documented attacks</th>
                <th className="p-3">Reported top drift</th></tr>
            </thead>
            <tbody>
              {inventory.map(signal => <tr key={signal.code} className="border-t border-border">
                <td className="p-3 font-mono font-semibold">{signal.code}</td>
                <td className="p-3">{groupTitle[featureGroup(signal.code)]}</td>
                <td className="p-3">{signal.constantReference ? 'Constant in reference' : 'Varied in reference'}</td>
                <td className="p-3">{signal.attackIds.length
                  ? signal.attackIds.map(i => `#${i}`).join(', ') : 'Not named in descriptions'}</td>
                <td className="p-3 tabular-nums">{signal.reportedTopDriftFraction === null
                  ? 'Not among reported top features'
                  : pct(signal.reportedTopDriftFraction)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {knownDrift.length} of the {inventory.length} displayed features have published
          per-feature drift values in the selected evaluation. An unlisted signal has no
          asserted zero-drift or all-clear verdict.
        </p>
      </section>
      <aside className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6"
        aria-label="Evidence limitations">
        <h2 className="font-semibold">Evidence and deployment boundaries</h2>
        <p className="mt-2 text-muted-foreground">
          This display reads committed BATADAL evaluation aggregates and the
          published attack-to-signal annotations. It cannot render raw hourly
          43-signal curves because that data is <strong>not bundled</strong>.
          It does not execute new model inference in the browser. Actual
          per-hour historical replay needs a separately checked, read-only CSV
          adapter and strict provenance verification. No PLC, actuator, network
          telemetry or physical security status is shown here.
        </p>
      </aside>
    </div>
  );
}
