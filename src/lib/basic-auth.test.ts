/** @jest-environment node */
import { credentialsMatch, parseAuthConfig, parseBasicHeader } from '@/lib/basic-auth';

const basic = (raw: string) => `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;

describe('parseAuthConfig', () => {
  it('leaves the demo open when the variable is unset or empty', () => {
    expect(parseAuthConfig(undefined)).toEqual({ mode: 'open' });
    expect(parseAuthConfig('')).toEqual({ mode: 'open' });
  });

  it('splits at the first colon so passwords may contain colons', () => {
    expect(parseAuthConfig('operator:pa:ss:word-long')).toEqual({
      mode: 'protected',
      credentials: { user: 'operator', password: 'pa:ss:word-long' },
    });
  });

  it.each([
    ['no colon', 'operator'],
    ['empty user', ':a-long-enough-password'],
    ['empty password', 'operator:'],
    ['password one character short', 'operator:12345678901'],
  ])('fails closed on %s', (_, value) => {
    expect(parseAuthConfig(value)).toEqual({ mode: 'misconfigured' });
  });

  it('accepts a password of exactly the minimum length', () => {
    expect(parseAuthConfig('operator:123456789012').mode).toBe('protected');
  });
});

describe('parseBasicHeader', () => {
  it('decodes Basic credentials, including UTF-8 and the scheme in any case', () => {
    expect(parseBasicHeader(basic('op:şifre:1'))).toEqual({ user: 'op', password: 'şifre:1' });
    expect(parseBasicHeader(basic('op:pw').replace('Basic', 'basic'))).toEqual({ user: 'op', password: 'pw' });
  });

  it.each([
    ['no header', null],
    ['another scheme', 'Bearer abc'],
    ['no credentials', 'Basic '],
    ['not base64', 'Basic %%%'],
    ['no colon inside', basic('operator')],
    ['invalid UTF-8', `Basic ${Buffer.from([0x6f, 0x3a, 0xff]).toString('base64')}`],
  ])('returns null for %s', (_, header) => {
    expect(parseBasicHeader(header)).toBeNull();
  });
});

describe('credentialsMatch', () => {
  const expected = { user: 'operator', password: 'correct-horse-battery' };

  it('accepts only an exact match of both parts', async () => {
    await expect(credentialsMatch({ ...expected }, expected)).resolves.toBe(true);
    await expect(credentialsMatch({ ...expected, user: 'Operator' }, expected)).resolves.toBe(false);
    await expect(credentialsMatch({ ...expected, password: 'correct-horse-battery ' }, expected)).resolves.toBe(false);
    await expect(credentialsMatch({ ...expected, password: 'correct-horse' }, expected)).resolves.toBe(false);
  });
});
