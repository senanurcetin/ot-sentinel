"""Documentation guards: links must resolve, and prose must not outrun the evidence.

While no real-data results file exists, the documents may not quote detection metrics and must say
the evaluation has not been run. When the file appears, these tests fail until the documents are
updated from it, so a stale "not run" claim cannot survive a real run.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "src" / "data" / "batadal-case-study" / "results.json"

DOCS = [
    ROOT / "README.md",
    ROOT / "MODEL_CARD.md",
    ROOT / "SECURITY.md",
    ROOT / "CONTRIBUTING.md",
    ROOT / "DEPENDENCIES.md",
    ROOT / "CHANGELOG.md",
    ROOT / "analysis" / "README.md",
    *sorted((ROOT / "docs").glob("**/*.md")),
]
# Documents that discuss the evaluation and therefore must carry the status statement.
EVALUATION_DOCS = [
    ROOT / "README.md",
    ROOT / "MODEL_CARD.md",
    ROOT / "analysis" / "README.md",
    ROOT / "docs" / "case-study.md",
    ROOT / "docs" / "hiring-summary.md",
]

LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
METRIC_WITH_VALUE = re.compile(
    r"\b(PR-AUC|ROC-AUC|AUC|precision|recall|F1|time-to-detect)\b[^\n.|]{0,25}?\b\d+\.\d+\b",
    re.IGNORECASE,
)
NOT_RUN = re.compile(r"\b(has not been run|not been run|not run|not yet run|not evaluated)\b", re.I)


def _rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def _links(doc: Path) -> list[str]:
    text = re.sub(r"```.*?```", "", doc.read_text(encoding="utf-8"), flags=re.S)  # skip code
    return [m.group(1) for m in LINK.finditer(text)]


@pytest.mark.parametrize("doc", DOCS, ids=_rel)
def test_relative_links_resolve(doc):
    broken = []
    for target in _links(doc):
        if re.match(r"^(https?:|mailto:|#)", target):
            continue
        path = target.split("#", 1)[0]
        if path and not (doc.parent / path).resolve().exists():
            broken.append(target)
    assert not broken, f"{_rel(doc)} links to missing files: {broken}"


def test_readme_references_existing_demo_assets():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assets = set(re.findall(r"docs/assets/[\w.-]+", readme))
    assert assets, "README should reference its screenshots and video"
    missing = [a for a in assets if not (ROOT / a).exists()]
    assert not missing, f"README references missing assets: {missing}"


@pytest.mark.skipif(RESULTS.exists(), reason="results exist; see the test below")
@pytest.mark.parametrize("doc", EVALUATION_DOCS, ids=_rel)
def test_without_results_docs_state_the_evaluation_was_not_run(doc):
    assert NOT_RUN.search(doc.read_text(encoding="utf-8")), (
        f"{_rel(doc)} must say the BATADAL evaluation has not been run"
    )


@pytest.mark.skipif(RESULTS.exists(), reason="results exist; see the test below")
@pytest.mark.parametrize("doc", EVALUATION_DOCS, ids=_rel)
def test_without_results_docs_quote_no_metric_values(doc):
    text = re.sub(r"```.*?```", "", doc.read_text(encoding="utf-8"), flags=re.S)
    found = METRIC_WITH_VALUE.findall(text)
    assert not found, f"{_rel(doc)} quotes metric values without a results file: {found}"


@pytest.mark.skipif(not RESULTS.exists(), reason="no results yet")
def test_with_results_the_documents_must_be_updated():
    pytest.fail(
        f"{_rel(RESULTS)} exists. Update README.md, MODEL_CARD.md, docs/case-study.md, "
        "docs/hiring-summary.md and analysis/README.md from it (remove the 'not run' statements, "
        "quote the measured values), then replace this guard with a check that every quoted "
        "number matches the results file."
    )


def test_guard_regexes_catch_what_they_should():
    assert METRIC_WITH_VALUE.search("PR-AUC: 0.91")
    assert METRIC_WITH_VALUE.search("event recall of 0.50")
    assert not METRIC_WITH_VALUE.search("PR-AUC and recall are the metrics")
    assert not METRIC_WITH_VALUE.search("the 0.37 % rate")
    assert NOT_RUN.search("it has not been run on BATADAL")
