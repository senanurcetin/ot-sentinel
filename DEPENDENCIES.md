# Dependencies

| Area | Package | Why |
|---|---|---|
| Framework | `next` 15, `react` 19, `typescript` | App Router UI and `/api/metrics` route |
| AI | `genkit`, `@genkit-ai/google-genai` (Gemini 2.5 Flash), `zod` | Structured, schema-validated threat explanations |
| UI | `tailwindcss`, shadcn/ui on `@radix-ui/*`, `recharts`, `lucide-react` | Dashboard, charts, icons |
| Dev | `jest`, `@testing-library/*`, `eslint` + `eslint-config-next` | Tests and lint |
| Dev (AI) | `genkit-cli`, `dotenv` | `npm run genkit:dev` loads `.env` |

`firebase` and `patch-package` were removed: nothing imported them.

## Known advisories

Last checked with `npm audit --omit=dev` after upgrading Next.js to 15.5.27:
0 critical, 15 high, 52 moderate. They sit in transitive trees:

- Genkit's OpenTelemetry/gRPC exporters (`@genkit-ai/core` → `@opentelemetry/*`, `@grpc/grpc-js`, `protobufjs`)
- Tailwind 3 build tooling (`tailwindcss` → `chokidar` → `braces`/`micromatch`), build-time only

CI fails on critical advisories. Highs are cleared by upgrading Genkit and migrating to Tailwind 4,
which Dependabot and the roadmap cover; they are not hidden.
