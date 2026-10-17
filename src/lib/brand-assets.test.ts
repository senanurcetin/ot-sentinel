/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('local official NEXUS identity assets', () => {
  it('uses script-free gradient vector marks from the approved identity export', () => {
    for (const name of ['nexus-x.svg', 'nexus-wordmark.svg']) {
      const svg = readFileSync(join(process.cwd(), 'public', name), 'utf8');
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('#00E0FF');
      expect(svg).toContain('#6E55C6');
      expect(svg).not.toMatch(/<script|<foreignObject|onload=/i);
    }
  });
});
