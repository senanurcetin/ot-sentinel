# Dependencies

| Area | Package | Why |
|---|---|---|
| Framework | `next` 15, `react` 19, `typescript` 5 | App Router UI and `/api/metrics` route |
| AI | `genkit`, `@genkit-ai/google-genai` (Gemini 2.5 Flash), `zod` | Structured, schema-validated threat explanations |
| UI | `tailwindcss`, shadcn/ui on `@radix-ui/*`, `recharts`, `lucide-react` | Dashboard, charts, icons |
| Dev | `jest`, `@testing-library/*`, `eslint` + `eslint-config-next` | Tests and lint |
| Dev (AI) | `genkit-cli`, `dotenv` | `npm run genkit:dev` loads `.env` |

`firebase` and `patch-package` were removed: nothing imported them.

## Upgrade policy

- **Minor and patch** updates arrive as one grouped Dependabot PR a week (npm), one for GitHub Actions and one for
  the Python analysis; they are merged when CI is green.
- **Majors** arrive one per PR and are merged only with whatever migration they need. The ones below were tried
  (as Dependabot PRs, 2026-10-07), failed CI for the reason given, and are ignored in `.github/dependabot.yml`
  until someone does the migration deliberately:

| Package | Held at | Blocked by (from the failing CI run) |
|---|---|---|
| `typescript` | 5.x | typescript-eslint (via `eslint-config-next`) does not support TypeScript 7 |
| `zod` | 3.x | `@genkit-ai/next` has a peer dependency on zod 3 (`npm ci` fails with ERESOLVE) |
| `tailwindcss` | 3.x | Tailwind 4 moved its PostCSS plugin to `@tailwindcss/postcss` and changed the config types |
| `recharts` | 2.x | Recharts 3 changed its TypeScript types; `src/components/ui/chart.tsx` needs porting |
| `@types/node` | 24.x | follows the Node runtime (Node 24 in CI and the Docker image), not the newest Node |

- **Runtime**: Node 24 (active LTS) in CI and the Docker image. Node 20 reached end of life on 2026-04-30.
- **Python** requirements are lower bounds; CI installs the newest versions on every run, so a bound is raised only
  when a release falls outside it. The BATADAL results were re-run with numpy 2.4.6, pandas 3.0.6 and
  scikit-learn 1.9.1 and `results.json` did not change.

## Known advisories

Last checked on 2026-10-07 with `npm audit --omit=dev` (Next.js 15.5.27, Genkit 1.42):
0 critical, 13 high, 59 moderate (the same counts before and after the 2026-10-07 dependency updates). A critical
advisory in `proxy-addr` (transitive, via Genkit's Express dependency) appeared on 2026-10-06 and was cleared with
`npm audit fix`; the CI gate caught it. The remaining ones sit in transitive trees:

- Genkit's OpenTelemetry exporters (`@genkit-ai/core` → `@opentelemetry/*`); several of these have no fixed version yet
- Tailwind 3 build tooling (`tailwindcss` → `chokidar` → `braces`/`micromatch`), build-time only

CI fails on critical advisories. The highs need a Genkit release with fixed exporters and the Tailwind 4 migration
above; they are listed here rather than hidden.
