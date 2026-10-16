# Local browser replay workbench

Open **`/offline-replay`** from the dashboard. The page runs in a secure browser
context (HTTPS or localhost) and makes **no file uploads** or Gemini requests.

1. Select a JSON array of three-sensor readings, with strictly increasing UTC
   `timestamp` and exactly `metrics.temp`, `metrics.pressure`,
   `metrics.vibration` numeric fields.
2. Select a manifest JSON following
   [the strict v1 contract](OFFLINE_REPLAY_CONTRACT.md) (exact source label,
   SHA-256, row count, UTC interval and cadence).
3. Obtain the expected **SHA-256 of the original raw recording bytes from an
   independently reviewed source**. Paste the 64-character lowercase digest
   into the verification field; do not copy it solely from the untrusted manifest.
4. Select **Verify and open replay**, then step through the recorded samples.
   **Restart** rechecks the original raw bytes and the independent checksum.

## Synthetic test fixture

For a smoke test only, use `tests/fixtures/offline-recording.json` and
`tests/fixtures/offline-recording.manifest.json`. Their expected SHA-256 is
`b9d39cd41d9358d143432876db77de7ac70e315d9dc4ac1ee4972f34160b2936`
and is pinned independently in the automated E2E test. This is a **synthetic
test recording**, not real plant data or independently attested industrial evidence.

## Threat boundary

- The local browser verifies equality with the caller's digest; hashes are
  not signatures, and an attacker controlling the trusted digest can also forge
  an apparently matching recording.
- No PLC discovery, Modbus/OPC UA reads/writes, file uploads or operating
  environment action is performed. The `GET /api/metrics` dashboard is still
  completely separate and synthetic.
- Historical detector verdicts are computed by the **three-sensor demonstration
  scorer**. They are not predictions by the offline **BATADAL 43-signal model**.
  End-of-recording does not assert that any plant is currently safe.
- File caps are 2 MiB for the recording, 16 KiB for the manifest, and 10,000 rows.
  Missing/irregular timestamps and unknown fields fail closed.
