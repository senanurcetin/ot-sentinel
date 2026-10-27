# Offline three-sensor replay contract — browser-only, not live `/api/metrics`

A source-controlled, **read-only**, deterministic replay building block is implemented in [`src/lib/recorded-telemetry.ts`](../src/lib/recorded-telemetry.ts). This is a pure in-memory TypeScript interface: it never opens a socket, reads a PLC, queries a historian, invokes Gemini, or writes to an OT network.

**Current scope:** three demonstration sensors (`temp`, `pressure`, `vibration`) only. The `/offline-replay` browser workbench is an implemented, separate user-facing route; **no replay switch has been added to `GET /api/metrics`**, which stays synthetic. Browser-local recordings are not the BATADAL 43-signal benchmark and do not replace the offline study in `analysis/`. There is no server upload endpoint or live OT feed.

## Example for unit tests and authorized offline processing

```ts
import { RecordedTelemetrySource } from '@/lib/recorded-telemetry';

const source = new RecordedTelemetrySource([
  {
    timestamp: '2026-10-16T10:00:00Z',
    metrics: { temp: 50, pressure: 1010, vibration: 0.055 },
  },
  {
    timestamp: '2026-10-16T10:00:01Z',
    metrics: { temp: 130, pressure: 1010, vibration: 0.055 },
  },
]);
const first = source.next('normal');
const second = source.next('normal');
// The third next() raises RangeError rather than replaying old data.
```

### Fail-closed data rules

- **1–10,000 samples** at construction; extra rows are rejected rather than unboundedly retained.
- Timestamps must be valid **UTC ISO-8601**, with strictly increasing time; duplicates, invalid dates, timezone-ambiguous and out-of-order rows are rejected.
- Sensor values must be finite numbers; invalid measurements stop construction before producing an unearned `SECURE` classification.
- Each row must contain exactly `timestamp` and `metrics`; the metrics object must contain exactly `temp`, `pressure`, and `vibration`. Unexpected fields, including claimed device identifiers, are rejected rather than laundered into evidence.
- The scorer is the repository's existing deterministic **three-sensor demonstration** scorer; an AI model cannot alter the verdict.
- The source preserves recorded timestamps, makes an internal copy, returns fresh copies and stops at end-of-recording.
- **No network-traffic data is supplied.** The required metrics shape carries `traffic_volume: 0` as a placeholder, labels `network_traffic` as *not recorded*, and states that limitation in the log. Never interpret that zero as a measured absence of network traffic.
- The `attack` toggle is intentionally ignored: historical readings are not modified to satisfy a demonstration switch.

## Recorded byte integrity and cadence gate

The offline-only `loadVerifiedOfflineReplay(raw, manifest, trustedSha256)` helper
(`src/lib/offline-replay-integrity.ts`) validates **the original UTF-8 JSON
byte sequence** before creating the in-memory replay source.

- Input size is capped at **2 MiB**, with **1–10,000 rows**.
- The manifest has a strict v1 schema, informational `source_label`,
  SHA-256 digest, row count, first and last UTC timestamps, and expected cadence.
- An **independently trusted SHA-256 digest** must also be supplied by the
  caller (for example, a separately reviewed or signed release document).
  Calculating this digest from the same untrusted recording/manifest is **not**
  an authenticity check; SHA-256 alone is not a signature.
- The computed hash must match both the manifest and the independent digest.
  Every timestamp gap or irregular interval is rejected, not filled or interpolated.
- The existing strict row parser rejects unexpected fields and invalid readings;
  the replay stops at EOF instead of falsely reporting `SECURE` telemetry.
- `source_label` is display-only metadata and does **not** establish that
  measurements originated from a PLC, historian or physical asset.

The Node verification helper remains a developer/API-layer primitive. A separate
[local browser workbench](../src/app/offline-replay/page.tsx) (served at `/offline-replay`) now implements the same strict schema
and independent SHA-256 verification using browser Web Crypto. It reads the two
user-selected local files, processes them in browser memory and does **not**
send them to a server endpoint, Gemini, or an OT network. It lets operators
step through recorded samples (never inferring an ongoing live safety status).
There is no public upload endpoint or live dashboard replay source.

The workbench also charts **only the samples actually stepped through**, showing
recorded UTC temperature and the demo detector's computed risk score. Display
history is capped to the most recent 120 reviewed samples (not a full-recording
metric); the chart never interpolates missing intervals or plots a synthetic
network trace. Restart clears the reviewed history; EOF does not convert an
old historical SECURE verdict into a current security state.
One-click 10- and 100-row advance controls synchronously score every recorded
row in the batch, never skip intervening evidence, clamp at EOF and retain the
same bounded displayed history.

A local JSON review export is available after at least one inspected sample.
Its schema is `ot-sentinel/local-reviewed-window/v1`. Only the current
**120-sample maximum reviewed window** appears in `reviewed_samples`; the
`inspected_rows_since_last_restart` field distinguishes this display scope
from the recording's total row count. The report explicitly states that the
physical source is **NOT VERIFIED**, network traffic was **NOT RECORDED**,
and decisions come from a **synthetic three-sensor demo model**. The export is
neither cryptographically signed nor a complete forensic chain of custody.
No file bytes are uploaded by this feature.

The UI requires a *separately sourced* 64-character lowercase SHA-256 digest.
Copying the hash from the submitted manifest alone does not establish trust.
The label of the recording remains unverified metadata; the three-sensor
demo model does not acquire the BATADAL benchmark's 43-signal provenance.
The live dashboard stays synthetic until a separate API/availability release gate.

### Separate release gate for any actual dashboard or BATADAL replay

Before wiring this to `/api/metrics`, define and verify the input schema, trusted source identity, hash, timestamp cadence and missing-data representation. In particular, **do not** down-project BATADAL 43 signals to these three fabricated demo sensor names or imply that an untested adapter observes live control equipment. Browser and service tests must prove stale/exhausted readings appear as unavailable instead of secure. Physical PLC write access is out of scope.
