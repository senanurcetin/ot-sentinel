# Offline three-sensor replay contract (not yet a live dashboard feature)

A source-controlled, **read-only**, deterministic replay building block is implemented in [`src/lib/recorded-telemetry.ts`](../src/lib/recorded-telemetry.ts). This is a pure in-memory TypeScript interface: it never opens a socket, reads a PLC, queries a historian, invokes Gemini, or writes to an OT network.

**Current scope:** three demonstration sensors (`temp`, `pressure`, `vibration`) only. This **does not load BATADAL's 43-signal benchmark** and does not replace the BATADAL offline study in `analysis/`. The running `GET /api/metrics` route is **still synthetic**; no replay switch or new public endpoint has been exposed.

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

### Separate release gate for any actual dashboard or BATADAL replay

Before wiring this to `/api/metrics`, define and verify the input schema, trusted source identity, hash, timestamp cadence and missing-data representation. In particular, **do not** down-project BATADAL 43 signals to these three fabricated demo sensor names or imply that an untested adapter observes live control equipment. Browser and service tests must prove stale/exhausted readings appear as unavailable instead of secure. Physical PLC write access is out of scope.
