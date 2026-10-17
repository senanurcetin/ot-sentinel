/**
 * Release evidence should identify the exact deployed Git revision, not just a
 * semver package version. An absent/invalid environment claim becomes null;
 * never fabricate a SHA or leak other process environment variables.
 */
export function publicRevision(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
    ? value
    : null;
}
