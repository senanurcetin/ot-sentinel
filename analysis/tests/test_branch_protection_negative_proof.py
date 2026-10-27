"""Disposable branch-protection negative test; NEVER merge into main.

For repository rule enforcement verification (#66). This test is intentionally
false to confirm analysis-quality fails and merge of this PR is blocked.
"""


def test_branch_protection_rejects_red_ci():
    assert False, "INTENTIONAL RED CI: #66 branch-protection negative proof"
