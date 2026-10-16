"""Guard basic CI trigger parity during the CircleCI migration.

This is a narrow text-level regression guard, not a security audit or a YAML
interpreter. Actual per-commit status checks remain the release gate.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_circleci_checks_real_browser_as_well_as_web_and_analysis():
    workflow = (ROOT / ".circleci" / "config.yml").read_text(encoding="utf-8")
    assert "browser-e2e:" in workflow
    assert "command: npm run test:e2e" in workflow
    assert "command: npx playwright install --with-deps chromium" in workflow
    assert "command: npm run test:coverage -- --runInBand" in workflow
    assert "command: cd analysis && python -m pytest -q" in workflow
    assert "      - browser-e2e" in workflow


def test_github_security_keeps_automatic_and_scheduled_coverage():
    security = (ROOT / ".github" / "workflows" / "security-checks.yml").read_text(
        encoding="utf-8"
    )
    # Changes that drop these must explicitly update the release model.
    assert "\n  pull_request:" in security
    assert "\n  push:" in security
    assert "\n  schedule:" in security
    for job in ("npm-audit:", "pip-audit:", "codeql:", "secret-scan:"):
        assert f"  {job}" in security
    assert "github/codeql-action/analyze@" in security
    assert "pip-audit -r analysis/requirements.txt" in security
    assert "gitleaks/gitleaks-action@" in security


def test_duplicate_github_quality_jobs_are_manual_but_docker_is_automatic():
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "\n  pull_request:" in ci
    assert "\n  push:" in ci
    assert ci.count("if: github.event_name == 'workflow_dispatch'") == 2
    assert "\n  docker:" in ci
    assert "name: Docker image builds" in ci
    assert "needs: web" not in ci

    e2e = (ROOT / ".github" / "workflows" / "e2e-tests.yml").read_text(
        encoding="utf-8"
    )
    # The Chromium test is automatically enforced by CircleCI browser-e2e.
    assert "\n  workflow_dispatch:" in e2e
    assert "\n  pull_request:" not in e2e
    assert "\n  push:" not in e2e
