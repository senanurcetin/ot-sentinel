import { publicRevision } from './release-revision';

describe('release SHA visibility', () => {
  it('returns only full public Git revisions', () => {
    const sha = 'a'.repeat(40);
    expect(publicRevision(sha)).toBe(sha);
    for (const unsafe of ['a'.repeat(39), 'A'.repeat(40), 'x'.repeat(40),
      'a'.repeat(40) + ';token=secret', ' ', null, undefined, 42]) {
      expect(publicRevision(unsafe)).toBeNull();
    }
  });
});
