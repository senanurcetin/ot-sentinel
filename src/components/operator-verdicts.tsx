'use client';

import { useEffect, useState } from 'react';
import type { FeedbackSummary } from '@/lib/feedback-store';

const percent = (share: number) => `${Math.round(share * 100)} %`;

/**
 * One-line summary of the operator verdicts this server has stored (GET /api/feedback/summary),
 * with the false-alarm share per sensor that drove the alert.
 */
export default function OperatorVerdicts() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/feedback/summary')
      .then((res) => (res.ok ? (res.json() as Promise<FeedbackSummary>) : Promise.reject(res.status)))
      .then((data) => active && setSummary(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <p className="text-sm text-muted-foreground">Operator verdicts are unavailable.</p>;
  if (!summary) return <p className="text-sm text-muted-foreground">Loading operator verdicts…</p>;
  if (summary.total === 0) {
    return <p className="text-sm text-muted-foreground">No operator verdicts recorded yet.</p>;
  }

  const storage =
    summary.storage === 'sqlite' ? 'stored in SQLite' : 'kept in memory and lost on restart';
  return (
    <div className="space-y-1 text-sm" aria-label="Operator verdicts">
      <p>
        <span className="font-medium">Operator verdicts:</span> {summary.confirmed_threat} confirmed
        threat{summary.confirmed_threat === 1 ? '' : 's'}, {summary.false_alarm} false alarm
        {summary.false_alarm === 1 ? '' : 's'}
        {summary.false_alarm_share !== null && ` (${percent(summary.false_alarm_share)} false alarms)`};{' '}
        <span className="text-muted-foreground">{storage}.</span>
      </p>
      {summary.by_top_sensor.length > 0 && (
        <p className="text-muted-foreground">
          False alarms by the sensor that drove the alert:{' '}
          {summary.by_top_sensor
            .map((s) => `${s.sensor} ${s.false_alarm} of ${s.total}`)
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}
