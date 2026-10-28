# OT-Sentinel documentation guide

OT-Sentinel is an **industrial-security demonstration and offline research portfolio**, not a deployed OT monitoring product. Its running dashboard uses **synthetic three-sensor readings**. The separate BATADAL views use authentic publisher-verified **43-channel historical attack-window excerpts**, not full live plant telemetry. No PLC/Modbus/OPC UA connection or actuator write capability is claimed.

## Choose the right entry point

| Goal | Canonical source | Important boundary |
| --- | --- | --- |
| Overview, setup, screenshots and quality checks | [README](../README.md) | Synthetic live dashboard; no production OT claim |
| Component diagram and alert processing | [Architecture](architecture.md) | The LLM explains; deterministic detector decides |
| Public benchmark methods and results | [Case study](case-study.md), [analysis guide](../analysis/README.md), [model card](../MODEL_CARD.md) | Offline research, not plant validation or a live 43-channel scorer |
| BATADAL summary explorer | [Explorer contract](BATADAL_EVIDENCE_EXPLORER.md) | Aggregate findings and feature inventory, not a reconstructed hourly curve |
| Original 2016 43-channel attack-window charts | [Verified 2016 excerpt](BATADAL_VERIFIED_HOURLY.md) | 660 source-measured hours; not the 4,177-hour complete 2016 horizon |
| Original 2017 43-channel attack-window charts | [Verified 2017 excerpt](BATADAL_VERIFIED_TEST_HOURLY.md) | 575 source-measured hours; not the 2,089-hour complete 2017 horizon |
| Local three-sensor JSON replay | [Browser workbench](LOCAL_REPLAY_WORKBENCH.md), [data integrity contract](OFFLINE_REPLAY_CONTRACT.md) | All file bytes stay in the browser; no server upload or physical-source attestation |
| Self-reported operator verdicts and API responses | [Feedback contract](operator-feedback-analytics.md) | User-submitted *labels*; not attack ground truth or detector false-positive rate |
| Public-demo login and identity boundary | [Demo access](demo-access.md), [threat model](threat-model.md) | Optional shared password is not per-user OT authorization; Preview SSO is independent |
| CI and branch merge checks | [CI coverage](ci-coverage-contract.md) | Automatic CircleCI quality and GitHub security checks must pass on exact PR HEAD |
| NEXUS visuals | [Brand rules](NEXUS_OFFICIAL_BRAND.md) | CI does not replace human visual/accessibility review |
| Fixed-before-run temporal analysis | [Protocol v3](protocol-v3.md) | Use predeclared rules; do not change benchmarks after seeing the holdout |

## Status and release decisions

The working product and **release acceptance** are distinct:

- **Implemented:** Synthetic dashboard, deterministic scoring and offline fallback, browser-only replay of independently checksummed three-sensor files, stored demo verdict aggregates with **machine-readable unverified provenance**, and separately source-verified 2016/2017 BATADAL attack-window visualizations.
- **Not established:** Full-horizon publisher-data exploration with source-separated hourly model scores; real PLC adapters; identity-attributed incident labels; verified authenticated **exact-commit** hosted browser/mobile/accessibility checks; trusted public ingress, rollback exercise or Production/OT certification.
- **Current gate:** GitHub `main` is reported as protected, but required-check/reviewer configuration still merits independent administrator verification. `READY` Preview is only a build state. The owner must verify authenticated routes using the opt-in, read-only [exact-SHA smoke procedure](../README.md#protected-preview-release-acceptance) and review the result before any public release.

Tracked open work: [#53 OT hardening](https://github.com/senanurcetin/ot-sentinel/issues/53), [#70 full-horizon BATADAL](https://github.com/senanurcetin/ot-sentinel/issues/70), [#72 protected Preview and release](https://github.com/senanurcetin/ot-sentinel/issues/72). [Merged PR #106](https://github.com/senanurcetin/ot-sentinel/pull/106) documents the demo-verdict trust boundary; it does **not** close all OT-05/06 or release gates.

## When documenting new results

Record the **source repository/commit or input-file SHA-256, dataset and exact evaluation split, successful test run, known limitations, and whether the result is source data, user assertion, offline model output, or synthetic demonstration**. Keep archive material in [the archived blueprint](archive/blueprint.md); do not promote historical CI or security snapshots into current guarantees.

Never paste tokens, raw sensitive operational telemetry, unauthorized OT network paths or private plant identifiers into docs or issue reports.
