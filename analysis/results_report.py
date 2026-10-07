"""Render the BATADAL results tables for the documentation from results.json.

Every number in the documents comes from here, never from hand-typed prose:

    python results_report.py          # rewrite the generated blocks in README.md and docs/case-study.md
    python results_report.py --check  # exit 1 if a block is stale (also run by pytest)

A generated block sits between ``<!-- BEGIN results:<name> -->`` and ``<!-- END results:<name> -->``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import batadal_data as bd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "src" / "data" / "batadal-case-study" / "results.json"
TARGETS = {
    ROOT / "README.md": ["summary", "v3-decision"],
    ROOT / "docs" / "case-study.md": [
        "summary",
        "v3-decision",
        "explanation",
        "per-attack",
        "drift",
        "data",
    ],
}

LABELS = {
    "static_limits": "Static limits",
    "zscore_max": "Max absolute z-score",
    "ewma_z": "EWMA of z-scores (v3)",
    "cusum": "CUSUM (v3)",
    "rolling_residual": "24 h rolling residual (v3)",
    "isolation_forest": "Isolation Forest",
    "hist_gradient_boosting": "Gradient boosting (supervised) †",
}
SET_TITLES = {
    "test": "Test set (attacks 8-14, Jan-Mar 2017): headline",
    "train": "dataset04 (attacks 1-7, Jul-Dec 2016): secondary",
}


def _scaled(value: float, digits: int) -> int:
    """``value`` rounded half-up to ``digits`` decimals, as an integer.

    results.json stores 4 decimals. Python's float formatting (round-half-even on the binary value)
    and JavaScript's toFixed disagree on exact ties such as 0.1825, which would make the README and
    the /case-study page show different numbers. Both sides therefore round the stored 4-decimal
    value half-up with integer arithmetic.
    """
    stored = round(value * 10_000)
    drop = 4 - digits
    return (stored + 5 * 10 ** (drop - 1)) // 10**drop if drop > 0 else stored


def _f(value, digits=3):
    return "n/a" if value is None else f"{_scaled(value, digits) / 10**digits:.{digits}f}"


def _pct(value):
    return "n/a" if value is None else f"{_scaled(value, 3) / 10:.1f} %"


def _hours(value):
    return "n/a" if value is None else f"{value:g}"


def _interval(bounds, digits=3):
    return "n/a" if not bounds else f"{_f(bounds[0], digits)} to {_f(bounds[1], digits)}"


def _intervals(ev: dict, name: str) -> dict:
    return ev.get("bootstrap", {}).get("intervals", {}).get(name, {})


def render_summary(results: dict) -> str:
    out = []
    for set_name in ("test", "train"):
        ev = results["evaluations"][set_name]
        total = ev["attack_hours"] + ev["attack_free_hours"]
        base = ev["attack_hours"] / total
        out += [
            f"**{SET_TITLES[set_name]}** - {ev['attacks']} attacks, {ev['attack_hours']} attack hours "
            f"({_pct(base)} of {total}); a random guess scores a PR-AUC of about {_f(base)}.",
            "",
            "| Detector | Attacks caught | Expected from false alarms alone | Median hours to detect "
            "| Alarm hours in attack-free data | Precision | Attack hours caught | PR-AUC "
            "| PR-AUC 95 % interval |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for name, det in ev["detectors"].items():
            e, p = det["event"], det["point"]
            out.append(
                f"| {LABELS[name]} | {e['events_detected']} of {e['n_events']} "
                f"| {_f(e['expected_events_detected_by_chance'], 1)} "
                f"| {_hours(e['median_time_to_detect_h'])} | {_pct(e['false_alarm_hour_fraction'])} "
                f"| {_pct(p['precision'])} | {_pct(p['recall'])} | {_f(p['pr_auc'])} "
                f"| {_interval(_intervals(ev, name).get('pr_auc'))} |"
            )
        for name in ev.get("not_evaluated", []):
            out.append(
                f"| {LABELS[name]} | not evaluated here: trained on this data | | | | | | | |"
            )
        out.append("")
    out.append(
        "† trained on dataset04 with the published attack intervals and evaluated on the test set only; "
        "an optimistic reference, not a deployable detector."
    )
    return "\n".join(out)


def render_v3_decision(results: dict) -> str:
    decision = results["decision"]
    ref = LABELS[decision["reference"]]
    boot = results["evaluations"]["test"]["bootstrap"]
    passed = [n for n, v in decision["detectors"].items() if v["better_than_reference"]]
    verdict = (
        "passes: " + ", ".join(LABELS[n] for n in passed)
        if passed
        else "no temporal detector passes; there is no detectable improvement over "
        f"{ref.lower()} on the test set"
    )
    out = [
        f"Protocol v3 decision rule (fixed in advance, [docs/protocol-v3.md](docs/protocol-v3.md)): "
        f"a temporal detector beats {ref.lower()} only if the 95 % interval of its paired PR-AUC "
        f"difference on the test set lies entirely above 0 ({boot['n_boot']} day-block bootstrap "
        f"resamples). Result: {verdict}.",
        "",
        f"| Detector | PR-AUC minus {ref.lower()}, 95 % interval | Better than {ref.lower()}? |",
        "|---|---:|:---:|",
    ]
    for name, verdict_row in decision["detectors"].items():
        out.append(
            f"| {LABELS[name]} | {_interval(verdict_row['pr_auc_diff_interval'])} "
            f"| {'yes' if verdict_row['better_than_reference'] else 'no'} |"
        )
    return "\n".join(out)


def render_explanation(results: dict) -> str:
    out = []
    for set_name in ("test", "train"):
        ev = results["evaluations"][set_name]
        named = [(n, d["explanation"]) for n, d in ev["detectors"].items() if d["explanation"]]
        out += [
            f"**{SET_TITLES[set_name]}**: share of alarmed attack hours whose three largest "
            "per-signal scores include a signal the attack description names.",
            "",
            "| Detector | Alarmed attack hours | Top 3 include an attacked signal | Chance level |",
            "|---|---:|---:|---:|",
        ]
        for name, x in named:
            out.append(
                f"| {LABELS[name]} | {x['alarmed_attack_hours']} | {_pct(x['hit_rate'])} "
                f"| {_pct(x['chance'])} |"
            )
        out += [
            "",
            "| Attack | Attacked signals (from the description) | "
            + " | ".join(LABELS[n] for n, _ in named)
            + " |",
            "|---:|---|" + "---:|" * len(named),
        ]
        signals = results["affected_signals"]
        for i, row in enumerate(named[0][1]["per_attack"]):
            cells = [_pct(x["per_attack"][i]["hit_rate"]) for _, x in named]
            out.append(
                f"| {row['attack']} | {', '.join(signals[str(row['attack'])])} | "
                + " | ".join(cells)
                + " |"
            )
        out.append("")
    out.append(
        "Isolation Forest and gradient boosting have no per-signal score and are not included. "
        "`n/a` = no alarm during that attack."
    )
    return "\n".join(out)


def render_per_attack(results: dict, attacks: list[bd.Attack]) -> str:
    replay = {a.id: "replay" in a.concealment.lower() for a in attacks}
    out = []
    for set_name in ("test", "train"):
        ev = results["evaluations"][set_name]
        names = list(ev["detectors"])
        out += [
            f"**{SET_TITLES[set_name]}**: hours from the published start to the first alarm "
            "(`missed` = no alarm during the attack).",
            "",
            "| Attack | Duration (h) | Replay concealment | "
            + " | ".join(LABELS[n] for n in names)
            + " |",
            "|---:|---:|:---:|" + "---:|" * len(names),
        ]
        rows = {n: {r["attack"]: r for r in ev["detectors"][n]["per_attack"]} for n in names}
        for row in ev["detectors"][names[0]]["per_attack"]:
            cells = []
            for n in names:
                r = rows[n][row["attack"]]
                cells.append(_hours(r["hours_to_detect"]) if r["detected"] else "missed")
            out.append(
                f"| {row['attack']} | {row['duration_hours']} | {'yes' if replay.get(row['attack']) else 'no'} "
                f"| " + " | ".join(cells) + " |"
            )
        out.append("")
    return "\n".join(out).rstrip()


def render_drift(results: dict) -> str:
    out = [
        "Share of attack-free evaluation hours in which a feature lies outside the min-max range "
        "of the 2014 reference data (descriptive only; nothing was adjusted for it).",
        "",
        "| Evaluation file | Attack-free hours | Hours with any feature outside range | Features most often outside range |",
        "|---|---:|---:|---|",
    ]
    for set_name in ("test", "train"):
        d = results["drift"][set_name]
        top = ", ".join(
            f"{k} ({_pct(v)})"
            for k, v in d["top_features_share_of_hours_outside_reference_range"].items()
        )
        out.append(
            f"| {set_name} | {d['normal_hours']} "
            f"| {_pct(d['share_of_hours_with_any_feature_outside_reference_range'])} | {top} |"
        )
    return "\n".join(out)


def render_data(results: dict) -> str:
    d, p = results["data"], results["protocol"]
    const = ", ".join(d["constant_features_in_reference"])
    return "\n".join(
        [
            f"- Reference (attack-free dataset03): {d['reference_rows']} hourly rows; "
            f"{d['reference_fit_rows']} used to fit, the last {d['reference_calibration_rows']} only to set thresholds.",
            f"- {d['n_features']} signals; constant in the reference and therefore kept: {const}.",
            f"- False-alarm budget used for every detector: {p['max_false_alarms_per_day']:g} alarm segment per attack-free day.",
            f"- Seed {p['seed']}, scikit-learn {p['scikit_learn']}.",
        ]
    )


def blocks(results: dict, attacks: list[bd.Attack]) -> dict[str, str]:
    return {
        "summary": render_summary(results),
        "v3-decision": render_v3_decision(results),
        "explanation": render_explanation(results),
        "per-attack": render_per_attack(results, attacks),
        "drift": render_drift(results),
        "data": render_data(results),
    }


def marker(name: str, end: bool = False) -> str:
    return f"<!-- {'END' if end else 'BEGIN'} results:{name}{'' if end else ' (generated by analysis/results_report.py)'} -->"


def apply_block(text: str, name: str, body: str) -> str:
    start, finish = text.find(f"<!-- BEGIN results:{name}"), text.find(marker(name, end=True))
    if start == -1 or finish == -1 or finish < start:
        raise ValueError(f"missing markers for results block '{name}'")
    header_end = text.index("-->", start) + 3
    return text[:header_end] + "\n" + body + "\n" + text[finish:]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    rendered = blocks(results, bd.load_attacks())
    stale = []
    for path, names in TARGETS.items():
        current = path.read_text(encoding="utf-8")
        updated = current
        for name in names:
            updated = apply_block(updated, name, rendered[name])
        if updated != current:
            stale.append(path)
            if not args.check:
                path.write_text(updated, encoding="utf-8")
    if args.check and stale:
        for path in stale:
            print(
                f"{path} has a stale results block; run python analysis/results_report.py",
                file=sys.stderr,
            )
        return 1
    if not args.check:
        print(
            "updated:",
            ", ".join(str(p.relative_to(ROOT)) for p in stale) or "nothing (already current)",
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
