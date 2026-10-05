# Contributing

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY
npm run dev              # http://localhost:9002
```

Before opening a PR run the same checks CI runs:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Conventions:

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Every number quoted in docs must come from a committed results file, not from memory.
- Telemetry/model constants live in one place; do not copy values between Python and TypeScript by hand.
