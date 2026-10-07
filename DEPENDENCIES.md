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

Last checked on 2026-10-06 with `npm audit --omit=dev` (Next.js 15.5.27, Genkit 1.42):
0 critical, 13 high, 59 moderate. A critical advisory in `proxy-addr` (transitive, via Genkit's Express
dependency) appeared that day and was cleared with `npm audit fix`; the CI gate caught it. The rest They sit in transitive trees:

- Genkit's OpenTelemetry exporters (`@genkit-ai/core` → `@opentelemetry/*`); several of these have no fixed version yet
- Tailwind 3 build tooling (`tailwindcss` → `chokidar` → `braces`/`micromatch`), build-time only

CI fails on critical advisories. Highs are cleared by upgrading Genkit and migrating to Tailwind 4,
which Dependabot and the roadmap cover; they are not hidden.
