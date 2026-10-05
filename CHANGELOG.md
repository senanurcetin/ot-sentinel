# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- ESLint flat config and a working `npm run lint`, enforced in CI
- Dockerfile (Next.js standalone, non-root) and a CI job that builds it
- Security workflow (npm audit gate on critical, CodeQL), Dependabot, PR template
- `SECURITY.md`, `DEPENDENCIES.md`, `CONTRIBUTING.md`

### Changed
- Package renamed from `nextn` to `ot-sentinel`
- Genkit default model moved from `gemini-1.5-flash-latest` to `gemini-2.5-flash`
- Next.js 15.5.9 → 15.5.27 (clears the critical advisory)
- Deployment is now "any container host or Vercel"; the unused Firebase App Hosting config was removed

### Removed
- Unused `firebase` and `patch-package` dependencies
