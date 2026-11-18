"""Guard that GitHub Actions runs every check CircleCI used to run.

This is a narrow text-level regression guard, not a security audit or a YAML
interpreter. Actual per-commit status checks remain the release gate.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_github_runs_real_browser_e2e_on_prs_and_main():
    e2e = (ROOT / ".github" / "workflows" / "e2e-tests.yml").read_text(
        encoding="utf-8"
    )
    lines = e2e.splitlines()
    assert "  pull_request:" in lines
    assert "  push:" in lines
    assert "npx playwright install --with-deps chromium" in e2e
    assert "run: npm run test:e2e" in e2e


def test_github_security_keeps_automatic_and_scheduled_coverage():
    security = (ROOT / ".github" / "workflows" / "security-checks.yml").read_text(
        encoding="utf-8"
    )
    # Changes that drop these must explicitly update the release model.
    assert "  pull_request:" in security.splitlines()
    assert "  push:" in security.splitlines()
    assert "  schedule:" in security.splitlines()
    for job in ("npm-audit:", "pip-audit:", "codeql:", "secret-scan:"):
        assert f"  {job}" in security
    assert "github/codeql-action/analyze@" in security
    assert "pip-audit -r analysis/requirements.txt" in security
    assert "gitleaks/gitleaks-action@" in security


def test_github_quality_and_docker_jobs_run_automatically():
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "  pull_request:" in ci.splitlines()
    assert "  push:" in ci.splitlines()
    # Web and analysis run on every PR; they must not be dispatch-only again.
    assert "if: github.event_name == 'workflow_dispatch'" not in ci
    for job in ("  web:", "  analysis:", "  docker:"):
        assert job in ci.splitlines()
    assert "  docker:" in ci.splitlines()
    assert "name: Docker image builds" in ci
    assert "needs: web" not in ci

    # Formerly CircleCI-only: the offline deployment smoke checker tests.
    assert "run: npm run test:deployment-smoke" in ci
