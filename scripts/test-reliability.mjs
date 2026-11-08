import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as client from '../src/usage-client.mjs';

const temporary = fn => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-test-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const credentials = { accessToken: 'test-only', accountId: 'test-account' };
test('credential paths honor explicit override, CODEX_HOME and default home', () => {
  assert.equal(client.authSource('', {}, '/home/test').file, path.resolve('/home/test/.codex/auth.json'));
  assert.equal(client.authSource('', { CODEX_HOME: '/custom' }).file, path.resolve('/custom/auth.json'));
  assert.equal(client.authSource('/explicit', { CODEX_HOME: '/custom' }).config, null);
});
test('storage diagnostics, malformed JSON, API key and file replacement', () => temporary(dir => {
  const source = client.authSource('', { CODEX_HOME: dir });
  assert.throws(() => client.readCredentials(source), { code: 'LOGIN' });
  fs.writeFileSync(source.file, '{');
  assert.throws(() => client.readCredentials(source), { code: 'AUTH_FORMAT' });
  fs.writeFileSync(source.file, JSON.stringify({ OPENAI_API_KEY: 'test-only' }));
  assert.throws(() => client.readCredentials(source), { code: 'API_KEY' });
  fs.writeFileSync(source.file, JSON.stringify({ tokens: { access_token: 'test-only', account_id: 'test-account' } }));
  assert.deepEqual(client.readCredentials(source), credentials);
  for (const store of ['keyring', 'auto', 'ephemeral']) {
    fs.writeFileSync(source.config, `cli_auth_credentials_store = "${store}"\n`);
    assert.throws(() => client.readCredentials(source), { code: 'STORAGE' });
    assert.deepEqual(client.readCredentials(client.authSource(source.file)), credentials);
  }
  fs.writeFileSync(source.config, '[profiles.test]\ncli_auth_credentials_store = "keyring"');
  assert.deepEqual(client.readCredentials(source), credentials);
  const revision = client.sourceRevision(source);
  fs.unlinkSync(source.file);
  assert.notEqual(client.sourceRevision(source), revision);
  fs.writeFileSync(source.config, 'cli_auth_credentials_store = broken');
  assert.throws(() => client.readCredentials(source), { code: 'AUTH_CONFIG' });
}));
for (const [status, code] of [[401,'AUTH'],[403,'ACCESS'],[429,'RATE_LIMIT'],[503,'SERVER'],[404,'ENDPOINT'],[400,'HTTP']]) {
  test(`HTTP ${status} is ${code} with sanitized errors`, async () => {
    await assert.rejects(client.requestJson('https://example.invalid', credentials, {
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, 'error');
        return new Response('secret body must not escape', { status, headers: { 'Retry-After': '90' } });
      },
    }), e => e.code === code && e.retryAfterMs === 90000 && !e.message.includes('secret'));
  });
}
test('timeout covers both headers and response body', async () => {
  for (const body of [false,true]) {
    await assert.rejects(client.requestJson('https://example.invalid', credentials, {
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) => {
        const pending = () => new Promise((_resolve,reject) => signal.addEventListener('abort', () => reject(new Error('abort'))));
        return body ? { ok: true, json: pending } : pending();
      },
    }), { code: 'TIMEOUT' });
  }
});
test('malformed response and network failure remain distinct', async () => {
  await assert.rejects(client.requestJson('x', credentials, { fetchImpl: async () => new Response('{') }), { code: 'ENDPOINT' });
  await assert.rejects(client.requestJson('x', credentials, { fetchImpl: async () => { throw new Error('private URL'); } }), { code: 'NETWORK', message: 'NETWORK' });
});
test('shared in-flight requests, cache, credential invalidation and backoff', async () => {
  let now = 100000, revision = 'a', calls = 0, finish;
  const source = { key: 'one' };
  const poller = new client.SharedPoller(async () => { calls++; return new Promise(resolve => { finish = resolve; }); }, { now: () => now, revision: () => revision, random: () => 0 });
  const a = poller.get(source), b = poller.get(source, { manual: true });
  assert.equal(calls, 1);
  finish({ usage: 'one' });
  assert.deepEqual(await a, await b);
  await poller.get(source); assert.equal(calls, 1);
  revision = 'b';
  const c = poller.get(source); assert.equal(calls, 2); finish({ usage: 'two' }); await c;
  now += 2000;
  poller.load = async () => { calls++; throw client.failure('RATE_LIMIT', { retryAfterMs: 90000 }); };
  await assert.rejects(poller.get(source, { manual: true }));
  await assert.rejects(poller.get(source, { manual: true })); assert.equal(calls, 3);
  assert.equal(poller.entry(source).retryAt, now + 90000);
  now += 90000;
  await assert.rejects(poller.get(source)); assert.equal(calls, 4);
  revision = 'c';
  poller.load = async () => ({ usage: 'recovered' });
  assert.equal((await poller.get(source)).usage, 'recovered');
  poller.prune(new Set()); assert.equal(poller.entries.size, 0);
});

test('action keeps transient readings stale, recovers on file changes, and ignores obsolete responses', async t => {
  let now = Date.now(), registered;
  const images = [], statuses = [], timers = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-action-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { CODEX_USAGE_MOCK_PAYLOAD: path.resolve('test-fixtures/green-usage.json'), CODEX_HOME: dir };
  const sdkAction = { id: 'test', setImage: async image => images.push(decodeURIComponent(image)), setTitle: async () => {}, showOk: async () => {}, showAlert: async () => {} };
  const context = vm.createContext({
    ...client, fs, process: { env }, Date: class extends Date { static now() { return now; } },
    authSource: override => client.authSource(override, env),
    SharedPoller: class extends client.SharedPoller { constructor(load) { super(load, { now: () => now, random: () => 0 }); } },
    SingletonAction: class {},
    streamDeck: { actions: { registerAction: action => { registered = action; } }, ui: { sendToPropertyInspector: async status => statuses.push(status) } },
    setInterval: fn => { timers.push(fn); return { unref() {} }; }, clearInterval() {},
  });
  const source = fs.readFileSync(new URL('../src/plugin.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^main\(\);/m, '');
  vm.runInContext(source + '\nglobalThis.api = { actions, poller, refreshAction };', context);
  await registered.onWillAppear({ action: sdkAction, payload: { settings: {} } });
  assert.equal(statuses.at(-1).state, 'ok');
  const originalTime = statuses.at(-1).lastUpdatedAt;
  now += 2000; env.CODEX_USAGE_MOCK_ERROR = 'NETWORK';
  await registered.onKeyDown({ action: sdkAction });
  assert.equal(statuses.at(-1).state, 'stale');
  assert.equal(statuses.at(-1).lastUpdatedAt, originalTime);
  assert.match(images.at(-1), /STALE/);
  assert.ok(!JSON.stringify(statuses).includes('access_token'));
  now += 20000; env.CODEX_USAGE_MOCK_ERROR = 'AUTH';
  await registered.onKeyDown({ action: sdkAction });
  assert.equal(statuses.at(-1).state, 'error');
  assert.equal(context.api.actions.get('test').lastUsage, null);
  assert.match(images.at(-1), /SIGN IN/);
  // A replaced login file bypasses the failed credential's retry budget immediately.
  delete env.CODEX_USAGE_MOCK_ERROR;
  fs.writeFileSync(path.join(dir, 'auth.json'), 'test fixture metadata only');
  timers[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(statuses.at(-1).state, 'ok');
  now += 2000;
  const releases = [];
  context.api.poller.load = async () => new Promise(resolve => releases.push(resolve));
  const oldRequest = registered.onKeyDown({ action: sdkAction });
  await new Promise(resolve => setImmediate(resolve));
  const changedRequest = registered.onDidReceiveSettings({ action: sdkAction, payload: { settings: { authPath: path.join(dir, 'other.json') } } });
  await new Promise(resolve => setImmediate(resolve));
  const fixture = JSON.parse(fs.readFileSync(env.CODEX_USAGE_MOCK_PAYLOAD, 'utf8'));
  releases[1]({ usage: { ...fixture, tag: 'new-account' } });
  await changedRequest;
  releases[0]({ usage: { ...fixture, tag: 'old-account' } });
  await oldRequest;
  assert.equal(context.api.actions.get('test').lastUsage.tag, 'new-account');
  now += 2000;
  let release;
  context.api.poller.load = async () => new Promise(resolve => { release = resolve; });
  const pending = registered.onKeyDown({ action: sdkAction });
  await new Promise(resolve => setImmediate(resolve));
  registered.onWillDisappear({ action: sdkAction });
  const count = images.length;
  release({ usage: JSON.parse(fs.readFileSync(env.CODEX_USAGE_MOCK_PAYLOAD, 'utf8')) });
  await pending;
  assert.equal(images.length, count);
});
