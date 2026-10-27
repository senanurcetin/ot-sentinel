# Operator feedback analytics: scope and provenance

OT-Sentinel records **self-reported demo operator verdicts**, not verified security ground truth.
A person can submit a verdict to `POST /api/feedback` without proving that an alert was
observed. Therefore these summaries are **not** detector precision, recall, benchmark
false-positive rates or independent confirmation of a plant incident.

## API contract

`GET /api/feedback/summary` returns:
- `provenance`: an explicit, invariant trust marker on **every** memory/SQLite summary, including empty stores:
  `source: "self_reported_demo_verdicts"`, `independently_verified: false`,
  `detector_performance_metric: false`. It is supplied by the server, not inferred
  from the client-submitted `verdict` field. See [merged PR #106](https://github.com/senanurcetin/ot-sentinel/pull/106).
- `total`, `confirmed_threat`, `false_alarm`, `false_alarm_share`: counts across retained submissions.
- `recent_24h`: the same four counts using the server-assigned `received_at` timestamp within
  the inclusive 24-hour rolling window. Caller-supplied event timestamps are not used for filtering;
  invalid and future ingestion timestamps cannot enter the window.
- `by_top_sensor`: retained all-time submissions grouped by the submitted top sensor (a constrained
  sensor enum). These do **not** prove that the sensor caused an actual threat.
- `storage`: `memory` (maximum 200 submissions, lost on restart) or `sqlite`
  (maximum 10,000 submissions, persistent only with `FEEDBACK_DB_PATH`).

A successful response is an **aggregate of submitted labels**, not validated incident outcomes. For example, `confirmed_threat: 2` means **two submissions were marked** `confirmed_threat`; it does not verify two cyberattacks. Likewise, `false_alarm_share` is the fraction **marked** false alarm, **not** a detector false-positive rate (which requires independent ground truth and a denominator of real evaluated cases).

The summary does not return free-text notes, IP addresses or individual records. Counts are
bounded to retained rows and can vary as older rows are evicted.

## Security and interpretation

The endpoint is rate-limited **per process**. Even a valid `provenance` marker is a disclosure, not tamper resistance or proof of operator identity. Public demo submissions can be manipulated,
and forwarded client IP headers may be spoofed if proxy trust is not configured. This is
observability for demo feedback, **not** a trustworthy feedback/labeling system.

If real authenticated operator analytics are required, add identity, alert-to-verdict
association, abuse prevention at a trusted proxy, retention policy and access controls
before treating any aggregates as evidence. BATADAL offline detector evaluation remains
separate from this API; no physical PLC or OT write capability is introduced.
