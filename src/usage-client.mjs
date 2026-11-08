import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ERROR_CODES = new Set(['LOGIN', 'AUTH', 'ACCESS', 'AUTH_READ', 'AUTH_FORMAT', 'AUTH_CONFIG', 'STORAGE', 'API_KEY', 'NETWORK', 'TIMEOUT', 'RATE_LIMIT', 'SERVER', 'ENDPOINT', 'HTTP']);
export const transient = error => ['NETWORK', 'TIMEOUT', 'RATE_LIMIT', 'SERVER'].includes(error?.code);
export const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

export function authSource(override = '', env = process.env, home = os.homedir()) {
  const root = env.CODEX_HOME || path.join(home, '.codex');
  const expand = value => value.replace(/^~(?=[\\/]|$)/, home);
  const file = path.resolve(expand(override || path.join(root, 'auth.json')));
  return { file, config: override ? null : path.resolve(expand(path.join(root, 'config.toml'))), key: `${override ? 'explicit' : 'auto'}:${process.platform === 'win32' ? file.toLowerCase() : file}`, label: override ? 'Custom file' : env.CODEX_HOME ? 'CODEX_HOME' : 'Default Codex file' };
}

export function sourceRevision(source) {
  return [source.file, source.config].map(file => {
    if (!file) return '';
    try { const s = fs.statSync(file, { bigint: true }); return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`; }
    catch (e) { return e.code; }
  }).join('|');
}

export function readCredentials(source) {
  let store = 'file';
  if (source.config) {
    try {
      const text = fs.readFileSync(source.config, 'utf8');
      // Only the root setting applies. Never pick a similarly named profile/provider setting.
      const root = text.split(/^\s*\[/m)[0];
      const match = root.match(/^\s*cli_auth_credentials_store\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
      if (match) store = match[1];
      else if (/^\s*cli_auth_credentials_store\s*=/m.test(root)) throw failure('AUTH_CONFIG');
    } catch (e) { if (e.code !== 'ENOENT') throw failure('AUTH_CONFIG'); }
  }
  if (!['file', 'auto', 'keyring', 'ephemeral'].includes(store)) throw failure('AUTH_CONFIG');
  // Never silently use an old file when Codex is configured to use another store.
  if (store !== 'file') throw failure('STORAGE', { storage: store });
  let text;
  try { text = fs.readFileSync(source.file, 'utf8'); }
  catch (e) { throw failure(e.code === 'ENOENT' ? store === 'auto' ? 'STORAGE' : 'LOGIN' : 'AUTH_READ'); }
  let auth;
  try { auth = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw failure('AUTH_FORMAT'); }
  if (auth?.auth_mode === 'apikey' || (!auth?.tokens?.access_token && auth?.OPENAI_API_KEY)) throw failure('API_KEY');
  const accessToken = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (typeof accessToken !== 'string' || !accessToken || typeof accountId !== 'string' || !accountId) throw failure('LOGIN');
  return { accessToken, accountId };
}

export async function requestJson(url, credentials, { fetchImpl = fetch, timeoutMs = 12000, now = Date.now } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal, redirect: 'error',
      headers: { Authorization: `Bearer ${credentials.accessToken}`, 'ChatGPT-Account-Id': credentials.accountId, 'User-Agent': 'codex-cli', Accept: 'application/json' },
    });
    if (!response.ok) {
      const status = response.status;
      const raw = response.headers.get('retry-after');
      const seconds = raw == null ? NaN : Number(raw);
      const retryAfterMs = Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(raw) || 0) - now());
      throw failure(status === 401 ? 'AUTH' : status === 403 ? 'ACCESS' : status === 429 ? 'RATE_LIMIT' : status >= 500 ? 'SERVER' : status === 404 ? 'ENDPOINT' : 'HTTP', { status, retryAfterMs });
    }
    try { return await response.json(); }
    catch (e) { throw controller.signal.aborted ? failure('TIMEOUT') : failure('ENDPOINT'); }
  } catch (e) {
    if (ERROR_CODES.has(e.code)) throw e;
    throw failure(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK');
  } finally { clearTimeout(timer); }
}

// One request and one retry budget per credential source, shared by all visible keys.
export class SharedPoller {
  constructor(load, { now = Date.now, revision = sourceRevision, random = Math.random } = {}) {
    this.load = load; this.now = now; this.revision = revision; this.random = random; this.entries = new Map();
  }
  entry(source) {
    const revision = this.revision(source);
    let entry = this.entries.get(source.key);
    if (!entry || entry.revision !== revision) {
      entry = { revision, failures: 0, retryAt: 0, value: null, pending: null };
      this.entries.set(source.key, entry);
    }
    return entry;
  }
  async get(source, { maxAgeMs = 300000, manual = false } = {}) {
    const entry = this.entry(source);
    if (entry.pending) return entry.pending;
    if (entry.error && this.now() < entry.retryAt) throw entry.error;
    if (!entry.error && entry.value && this.now() - entry.updatedAt < (manual ? 1000 : maxAgeMs)) return entry.value;
    entry.pending = (async () => {
      try {
        const value = await this.load(source);
        entry.updatedAt = this.now(); entry.value = { ...value, updatedAt: new Date(entry.updatedAt).toISOString(), revision: entry.revision };
        entry.error = null; entry.failures = 0; entry.retryAt = 0;
        return entry.value;
      } catch (e) {
        entry.error = e; entry.failures++;
        const delay = transient(e) ? Math.min(300000, 15000 * 2 ** Math.min(entry.failures - 1, 5)) * (1 + this.random() * 0.2) : 30000;
        entry.retryAt = this.now() + Math.max(delay, e.retryAfterMs || 0);
        throw e;
      } finally { entry.pending = null; }
    })();
    return entry.pending;
  }
  prune(keys) { for (const key of this.entries.keys()) if (!keys.has(key)) this.entries.delete(key); }
}
