'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MAX_OFFLINE_MANIFEST_BYTES, MAX_OFFLINE_REPLAY_BYTES } from '@/lib/offline-replay-contract';
import type { OfflineReplayManifest } from '@/lib/offline-replay-contract';
import { loadVerifiedOfflineReplayInBrowser } from '@/lib/offline-replay-browser';
import type { RecordedTelemetrySource } from '@/lib/recorded-telemetry';
import type { Metrics } from '@/lib/types';
import OfflineReplayTrends, { MAX_OFFLINE_TREND_SAMPLES } from '@/components/offline-replay-trends';
import { buildOfflineReviewReport, serializeOfflineReviewReport } from '@/lib/offline-replay-report';

type VerifiedInput = { raw: Uint8Array; manifest: OfflineReplayManifest; checksum: string };

export default function OfflineReplayWorkbench() {
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [trustedSha256, setTrustedSha256] = useState('');
  const [manifest, setManifest] = useState<OfflineReplayManifest | null>(null);
  const [current, setCurrent] = useState<Metrics | null>(null);
  const [trendSamples, setTrendSamples] = useState<Metrics[]>([]);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const sourceRef = useRef<RecordedTelemetrySource | null>(null);
  const verifiedInputRef = useRef<VerifiedInput | null>(null);

  const clearSession = () => {
    sourceRef.current = null;
    verifiedInputRef.current = null;
    setManifest(null);
    setCurrent(null);
    setTrendSamples([]);
    setCursor(0);
    setError('');
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearSession();
    if (!recordingFile || !manifestFile) {
      setError('Choose a local recording and manifest JSON file.');
      return;
    }
    if (recordingFile.size === 0 || recordingFile.size > MAX_OFFLINE_REPLAY_BYTES ||
        manifestFile.size === 0 || manifestFile.size > MAX_OFFLINE_MANIFEST_BYTES) {
      setError('Recording must be at most 2 MiB and manifest at most 16 KiB.');
      return;
    }
    setVerifying(true);
    try {
      const raw = new Uint8Array(await recordingFile.arrayBuffer());
      const metadata: unknown = JSON.parse(await manifestFile.text());
      const anchor = trustedSha256.trim();
      const source = await loadVerifiedOfflineReplayInBrowser(raw, metadata, anchor);
      sourceRef.current = source;
      const validated = metadata as OfflineReplayManifest;
      verifiedInputRef.current = { raw, manifest: validated, checksum: anchor };
      setManifest(validated);
      setCursor(0);
      setCurrent(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Offline replay verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const reviewNextSamples = (requested: 1 | 10 | 100) => {
    if (!sourceRef.current || !manifest || verifying || cursor >= manifest.row_count) return;
    // Process every intervening recorded row; these are not skipped or
    // interpolated samples. At most 100 are scored per synchronous action.
    const count = Math.min(requested, manifest.row_count - cursor);
    const reviewed: Metrics[] = [];
    try {
      for (let i = 0; i < count; i++) {
        reviewed.push(sourceRef.current.next('normal'));
      }
      setCurrent(reviewed[reviewed.length - 1]);
      setTrendSamples((previous) => [...previous, ...reviewed].slice(-MAX_OFFLINE_TREND_SAMPLES));
      setCursor((previous) => previous + reviewed.length);
    } catch {
      // Never leave a partially read source available after an error.
      sourceRef.current = null;
      setError('Recording stopped: failed to validate a historical sample.');
    }
  };

  const restart = async () => {
    const session = verifiedInputRef.current;
    if (!session) return;
    setVerifying(true);
    setError('');
    try {
      sourceRef.current = await loadVerifiedOfflineReplayInBrowser(
        session.raw, session.manifest, session.checksum
      );
      setCurrent(null);
      setTrendSamples([]);
      setCursor(0);
    } catch (cause) {
      clearSession();
      setError(cause instanceof Error ? cause.message : 'Replay verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const exportReviewedWindow = () => {
    const session = verifiedInputRef.current;
    if (!session || !manifest || trendSamples.length === 0) return;
    let url: string | undefined;
    try {
      const report = buildOfflineReviewReport(
        manifest, session.checksum, cursor, trendSamples
      );
      const data = serializeOfflineReviewReport(report);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ot-sentinel-reviewed-window.json';
      document.body.append(link);
      link.click();
      link.remove();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export local review');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  const finished = Boolean(manifest && cursor >= manifest.row_count);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold tracking-[.2em] text-primary">NEXUS / OT-SENTINEL</span>
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to monitoring dashboard
          </Link>
        </nav>

        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
            04 / Offline incident investigation
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Local Telemetry Replay</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Inspect a verified three-sensor recording, one historical sample at a time.
            Files are processed in your browser only; nothing is uploaded or sent to Gemini.
            This is not a live PLC feed, authenticated device evidence, or the BATADAL benchmark.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7" aria-label="Local recording verifier">
          <h2 className="mb-4 text-xl font-semibold">01 / Verify your recording</h2>
          <form onSubmit={verify} className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="recording-json" className="block text-sm font-medium">Recording JSON</label>
              <input id="recording-json" type="file" accept=".json,application/json" disabled={verifying}
                onChange={(event) => {
                  clearSession();
                  setRecordingFile(event.target.files?.[0] ?? null);
                }}
                className="block w-full min-w-0 rounded-md border border-border p-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">Strict UTC order, exactly three sensors, up to 10,000 rows and 2 MiB.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="manifest-json" className="block text-sm font-medium">Manifest JSON</label>
              <input id="manifest-json" type="file" accept=".json,application/json" disabled={verifying}
                onChange={(event) => {
                  clearSession();
                  setManifestFile(event.target.files?.[0] ?? null);
                }}
                className="block w-full min-w-0 rounded-md border border-border p-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">Contains row count, UTC time range, expected cadence and SHA-256.</p>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label htmlFor="trusted-digest" className="block text-sm font-medium">
                Independently verified SHA-256 (64 lowercase hexadecimal characters)
              </label>
              <input id="trusted-digest" type="text" autoComplete="off" spellCheck={false}
                value={trustedSha256} disabled={verifying}
                onChange={(event) => {
                  clearSession();
                  setTrustedSha256(event.target.value);
                }}
                placeholder="Paste the digest from a separate, trusted source"
                className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Do not copy this value from the recording or its untrusted manifest.
                A matching checksum proves byte agreement, not physical sensor authenticity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <button type="submit" disabled={verifying}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {verifying ? 'Verifying locally…' : 'Verify and open replay'}
              </button>
              <Link href="/case-study" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                View the separate BATADAL evaluation
              </Link>
            </div>
          </form>
          {error && <p role="alert" className="mt-4 rounded-md border border-rose-500/40 p-3 text-sm text-rose-400">{error}</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7" aria-label="Verified offline replay">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">02 / Recorded evidence</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {manifest ? `Verified local bytes · ${manifest.source_label} (label unverified)` : 'No verified recording loaded'}
              </p>
            </div>
            {manifest && <span role="status" className="rounded-md border border-sky-500/40 px-3 py-1 text-xs text-sky-300">
              LOCAL HASH VERIFIED
            </span>}
          </div>

          {manifest ? (
            <div className="space-y-5">
              <dl className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Recorded interval</dt><dd className="mt-1 font-mono text-xs">{manifest.start_utc} – {manifest.end_utc}</dd></div>
                <div><dt className="text-muted-foreground">Expected cadence</dt><dd className="mt-1 font-semibold">{manifest.cadence_ms} ms</dd></div>
                <div><dt className="text-muted-foreground">Replay position</dt><dd className="mt-1 font-semibold">{cursor} / {manifest.row_count}</dd></div>
              </dl>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label="Replay progress">
                <div className="h-full bg-primary transition-all" style={{ width: `${100 * cursor / manifest.row_count}%` }} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => reviewNextSamples(1)} disabled={finished || verifying}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  Next recorded sample
                </button>
                <button type="button" onClick={() => reviewNextSamples(10)} disabled={finished || verifying}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50">
                  Review next 10 samples
                </button>
                <button type="button" onClick={() => reviewNextSamples(100)} disabled={finished || verifying}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50">
                  Review next 100 samples
                </button>
                <button type="button" onClick={restart} disabled={verifying}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50">
                  Restart from first sample
                </button>
                <button type="button" onClick={exportReviewedWindow}
                  disabled={verifying || trendSamples.length === 0}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50">
                  Download reviewed JSON report
                </button>
              </div>
              {finished && <p role="status" className="text-sm text-muted-foreground">
                End of verified recording. No live telemetry is available; restart to review history.
              </p>}
              {current ? (
                <div className="space-y-4" aria-label="Historical sensor sample">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Recorded at {current.timestamp}</h3>
                    <span className={current.status === 'CRITICAL' ? 'font-semibold text-rose-400' : 'font-semibold text-sky-300'}>
                      Historical detector verdict: {current.status}
                    </span>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Temperature</dt><dd className="mt-2 text-2xl font-semibold">{current.metrics.temp.toFixed(2)} °C</dd></div>
                    <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Pressure</dt><dd className="mt-2 text-2xl font-semibold">{current.metrics.pressure.toFixed(2)}</dd></div>
                    <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Vibration</dt><dd className="mt-2 text-2xl font-semibold">{current.metrics.vibration.toFixed(3)} g</dd></div>
                    <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Risk (demo model)</dt><dd className="mt-2 text-2xl font-semibold">{current.risk_score}/100</dd></div>
                  </dl>
                  <section className="rounded-lg border border-border p-4" aria-label="Historical anomaly explanation">
                    <h4 className="mb-3 font-semibold">Why this historical score?</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {current.per_sensor_contributions.map((item) => (
                        <div key={item.sensor} className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium capitalize">{item.sensor}</span>
                            <span className="text-xs text-muted-foreground">z = {item.z_score.toFixed(2)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, item.contribution_pct))}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.contribution_pct.toFixed(1)}% of total z-score · {item.status}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <p className="text-sm text-muted-foreground">
                    Network traffic: NOT RECORDED. A placeholder value of zero is not a measured absence of traffic.
                  </p>
                </div>
              ) : <p className="text-sm text-muted-foreground">Verified and ready. Select “Next recorded sample” to start.</p>}
              {trendSamples.length > 0 && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Report includes only the last {trendSamples.length} inspected samples out of {cursor}
                  {' '}reviewed since restart, including every sample processed by a batch action. It records checksum agreement,
                  not authenticated device origin. JSON stays local.
                </p>
              )}
              {trendSamples.length > 0 && <OfflineReplayTrends samples={trendSamples} />}
            </div>
          ) : <p className="text-sm text-muted-foreground">
            Select both files and paste an independently sourced SHA-256 to unlock read-only historical playback.
          </p>}
        </section>
      </main>
    </div>
  );
}
