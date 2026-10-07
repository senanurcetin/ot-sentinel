# Threat model

OT-Sentinel is a **demonstration** dashboard. It runs on synthetic telemetry today (BATADAL replay
is planned, see `analysis/README.md`) and must not be connected to a live control network. This
document states what the project defends, what it does not, and which mitigations are tested.

## Assets and trust boundaries

```
 browser ──HTTP──▶ Next.js server ──HTTPS──▶ Gemini API
                     │   ▲
                     │   └── TelemetrySource (synthetic today; replay / read-only adapter later)
                     └── in-memory operator feedback (not persisted)
```

| Asset | Where | Why it matters |
|---|---|---|
| `GEMINI_API_KEY` | server env only | cost and quota; never sent to the browser |
| Detector parameters | `src/data/model/scorer-params.json` | an altered baseline changes what counts as an anomaly |
| Operator trust in the dashboard | UI | a wrong explanation or a silent failure misleads a person |

Trust boundaries: every request from the browser is untrusted (including **server action
arguments**); telemetry from a source is untrusted input to the scorer; LLM output is untrusted
text.

## Threats and mitigations

| # | Threat | Mitigation in this repo (tested) | Residual risk |
|---|---|---|---|
| 1 | Request flooding / cost abuse of `/api/metrics`, `/api/feedback` and the AI server action | Per-client fixed-window limits (180/min, 30/min, 10/min), model-call timeout (20 s), rule-based fallback when limited | Limits are **per instance** and keyed on `x-forwarded-for`, which a direct client can spoof. Use a shared limiter or WAF in front |
| 2 | Malformed or oversized input | zod validation on query, body and server-action input; 4 KB body cap (413); invalid query returns 400 | none known |
| 3 | Script injection / clickjacking | CSP (`frame-ancestors 'none'`, `object-src 'none'`, same-origin `connect-src`), `X-Frame-Options`, `nosniff`, HSTS, Referrer/Permissions-Policy; React escapes all text | CSP still allows `'unsafe-inline'` scripts (no per-request nonces yet) |
| 4 | Spreadsheet formula injection through the CSV export | Cells starting with `= + - @` (tab, CR) are prefixed with `'` | Other CSV consumers may interpret differently |
| 5 | Prompt injection via `log_entry` / `network_traffic` | Today these fields come from the server's own telemetry. The server action also accepts client-supplied values, but they only shape *that client's* explanation. The model is told the detector has already decided and not to invent facts; its output is rendered as plain text and triggers no action. The rule-based fallback echoes only a validated IPv4 literal | An explanation can still be wrong or misleading, which is why guidance always says to confirm at the field instrument |
| 6 | Secret exposure | `.env` is git-ignored, key is server-side, CI uses a placeholder, secret scanning in CI | A leaked key must still be rotated by the owner |
| 7 | Vulnerable dependencies | Dependabot (npm, pip, Actions), `npm audit` gate on critical, `pip-audit`, CodeQL | 15 high-severity advisories remain in transitive trees; see `DEPENDENCIES.md` |
| 8 | Detector evasion | None claimed. The scorer judges each sample against a static baseline, so slow drift or small coordinated changes inside normal ranges can pass | The BATADAL study measures hour-level detection and time-to-detect for seven methods, including three temporal ones that did not improve on the test file; it does not model an adaptive attacker |
| 9 | Feedback poisoning | `/api/feedback` is unauthenticated but only stores a capped in-memory list that nothing reads back | If verdicts ever tune thresholds, they need authentication and review |
| 10 | No authentication or authorisation | Not implemented | Anyone who can reach the app sees everything. Deploy only behind a VPN / SSO proxy |

## What the detector can and cannot say (MITRE ATT&CK for ICS)

The scorer sees *deviations of measured values from a baseline*. It cannot tell a process fault from
a failing sensor from an attack, and it does not identify a technique. The table lists techniques
that could produce a given symptom, as **hypotheses for an analyst**, not as detections.

| Symptom the detector flags | Techniques that could cause it | Note |
|---|---|---|
| Reported value far from baseline while the physical process looks normal | [T1692.002](https://attack.mitre.org/techniques/T1692/002/) Unauthorized Message: Reporting Message; [T0832](https://attack.mitre.org/techniques/T0832/) Manipulation of View | Compare with the local gauge |
| Real process variable out of range after a control change | [T0836](https://attack.mitre.org/techniques/T0836/) Modify Parameter; [T0831](https://attack.mitre.org/techniques/T0831/) Manipulation of Control; [T1692.001](https://attack.mitre.org/techniques/T1692/001/) Unauthorized Message: Command Message | Possible impact: [T0879](https://attack.mitre.org/techniques/T0879/) Damage to Property, [T0826](https://attack.mitre.org/techniques/T0826/) Loss of Availability |
| Flood of traffic | [T0814](https://attack.mitre.org/techniques/T0814/) Denial of Service | The traffic volume is displayed but not scored |
| Frozen or missing readings | [T0815](https://attack.mitre.org/techniques/T0815/) Denial of View; [T0829](https://attack.mitre.org/techniques/T0829/) Loss of View | **Not detected**: the scorer has no missing-data or stuck-value check |

Identifiers and names were checked on 2026-10-05 against MITRE's published ATT&CK for ICS data
(`mitre/cti`, `ics-attack`). Two identifiers that are widely quoted, T0855 (Unauthorized Command
Message) and T0856 (Spoof Reporting Message), are **revoked** there and replaced by T1692.001 and
T1692.002, so they are deliberately not used. Re-check before citing: ATT&CK is revised regularly.

## Telemetry adapter boundary

`src/lib/telemetry-source.ts` defines `TelemetrySource`; the API route depends only on it. Rules for
any future adapter (BATADAL replay, Modbus/TCP, OPC UA):

1. **Read-only and passive.** Poll a historian, a network tap/SPAN feed or a read-only OPC UA
   endpoint. Never implement write function codes, method calls or setpoint changes.
2. **Validate before scoring.** Reject non-finite values, out-of-range units and timestamps going
   backwards; surface a "stale/invalid data" state instead of scoring it.
3. **Fail visibly.** A dead source must show as unavailable, not as `SECURE`.
4. **Isolate.** Run the adapter in the monitoring zone; the dashboard host gets no route to the
   control network.

No protocol adapter is implemented; this is the interface and the rules, not a claim of support.

## Hardening backlog (not done)

Per-request CSP nonces (drop `'unsafe-inline'`); authentication and role separation; a shared rate
limiter; persistent, integrity-protected audit log and feedback store; checksum or signature for
`scorer-params.json`; missing-data and stuck-value detectors; temporal and cross-sensor models.
