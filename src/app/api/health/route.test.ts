/** @jest-environment node */
import { GET } from './route';
import { version } from '../../../../package.json';

describe('GET /api/health', () => {
  it('reports ok with the package version and is not cacheable', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'ok', version });
  });
});
