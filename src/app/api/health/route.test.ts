/** @jest-environment node */
import { version } from '../../../../package.json';
import { GET } from './route';

const keys = ['VERCEL_GIT_COMMIT_SHA', 'CIRCLE_SHA1', 'GITHUB_SHA'] as const;
const initial = Object.fromEntries(keys.map(k => [k, process.env[k]]));
afterEach(() => {
  for (const key of keys) {
    const value = initial[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /api/health release provenance', () => {
  it('reports ok and unknown SHA when a trusted build revision is unavailable', async () => {
    for (const key of keys) delete process.env[key];
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', version, commit: null });
  });

  it('returns only the exact public deployment SHA for release acceptance', async () => {
    for (const key of keys) delete process.env[key];
    process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
    expect(await GET().json()).toEqual({ status: 'ok', version, commit: 'a'.repeat(40) });
  });

  it('does not fabricate or expose malformed, partial or untrusted revisions', async () => {
    for (const key of keys) delete process.env[key];
    process.env.CIRCLE_SHA1 = 'not-a-full-commit';
    expect((await GET().json()).commit).toBeNull();
    process.env.CIRCLE_SHA1 = 'b'.repeat(40);
    expect((await GET().json()).commit).toBe('b'.repeat(40));
  });
});
