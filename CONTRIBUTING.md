# Contributing

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY
npm run dev              # http://localhost:9002
```

Before opening a PR run the same checks CI runs:

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build
cd analysis && pip install -r requirements-dev.txt && ruff check . && pytest
```

End-to-end tests (Playwright) start the app themselves:

```bash
npx playwright install chromium   # once
npm run test:e2e
```

Documentation is tested too (`analysis/tests/test_docs.py`): links must resolve, and numbers about
detection performance may only appear once a real results file exists.

`jest.config.ts` enforces a coverage floor; add tests with the change rather than lowering it.

Conventions:

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Every number quoted in docs must come from a committed results file, not from memory.
- Telemetry/model constants live in one place; do not copy values between Python and TypeScript by hand.

## Releasing

Move the `[Unreleased]` notes in `CHANGELOG.md` under a new `## [x.y.z] - date` heading, merge to `main`, then
push a tag on the merge commit (`git tag vX.Y.Z && git push origin vX.Y.Z`). The `Release` workflow refuses a
tag that is not on `main` and publishes a GitHub Release whose notes are that CHANGELOG section
(`scripts/release-notes.sh vX.Y.Z` previews them).
