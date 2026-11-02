import test from 'node:test';
import assert from 'node:assert/strict';
import { criticalRoutes, validateDeploymentOrigin, classifyDeploymentResponse as classify, readLimitedResponseText } from './deployment-smoke-core.mjs';

test('smoke response reader bounds untrusted bodies and cancels oversized streams', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('0123456789'));
    },
    cancel() { cancelled = true; },
  });
  assert.equal(await readLimitedResponseText(new Response(stream), 4), '0123');
  assert.equal(cancelled, true);
  await assert.rejects(readLimitedResponseText(new Response('ok'), 0), /limit/);
});

test('smoke response reader preserves UTF-8 split across stream chunks', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0xe2, 0x82]));
      controller.enqueue(new Uint8Array([0xac, 0x20, 0x41]));
      controller.close();
    },
  });
  assert.equal(await readLimitedResponseText(new Response(stream), 4), '€ ');
});

test('release smoke covers exactly the product routes plus health', () => {
  assert.deepEqual([...criticalRoutes], [
    '/', '/offline-replay', '/batadal-explorer', '/batadal-history',
    '/batadal-test-history', '/case-study', '/api/health',
  ]);
});

test('rejects unsafe origins, embedded credentials or path fragments', () => {
  for (const value of [
    'http://demo.example.com/', 'https://user:password@demo.example.com/',
    'https://demo.example.com/page', 'https://demo.example.com/?token=secret',
    'ftp://demo.example.com/',
  ]) assert.throws(() => validateDeploymentOrigin(value));
  assert.equal(validateDeploymentOrigin('https://demo.example.com/'), 'https://demo.example.com');
  assert.equal(validateDeploymentOrigin('http://localhost:9002/'), 'http://localhost:9002');
});

test('SSO login and redirects never count as healthy app', () => {
  for (const body of [
    '<html>Vercel Authentication</html>',
    '<html>Deployment Protection</html>',
    '<html>/_vercel/sso login</html>',
  ]) assert.equal(classify('/', { status: 200, contentType: 'text/html', body }).ok, false);
  assert.equal(classify('/', { status: 302, contentType: 'text/html', body: '' }).ok, false);
  assert.equal(classify('/', { status: 401, contentType: 'text/html', body: '' }).ok, false);
});

test('accepts real HTML route and JSON health contracts only', () => {
  assert.deepEqual(classify('/', { status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="en"></html>' }), {
    ok: true, reason: 'HTML route responded',
  });
  assert.equal(classify('/api/health', { status: 200, contentType: 'application/json', body: '{"status":"ok","version":"0.3.0"}' }).ok, true);
  for (const body of ['{"status":"down"}', '{"status":"ok"}', 'not-json', '<html>ok</html>']) {
    assert.equal(classify('/api/health', { status: 200, contentType: 'application/json', body }).ok, false);
  }
});

test('refuses stale deployment SHA, missing commit or a forged partial revision', () => {
  const sha = 'a'.repeat(40);
  const health = (commit) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', version: '0.3.0', commit }),
  });
  assert.deepEqual(classify('/api/health', health(sha), sha), {
    ok: true, reason: 'health contract and exact deployment SHA verified',
  });
  for (const commit of [null, undefined, 'b'.repeat(40), sha.slice(0, 8)]) {
    const response = classify('/api/health', health(commit), sha);
    assert.equal(response.ok, false);
    assert.match(response.reason, /SHA/);
  }
  assert.equal(classify('/api/health', health(sha), 'short').ok, false);
  assert.equal(classify('/api/health', health(sha), null).ok, true);
});
