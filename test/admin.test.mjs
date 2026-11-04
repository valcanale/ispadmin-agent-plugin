import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSettingsStore} from '../src/settings.mjs';
import {startAdminServer} from '../src/admin.mjs';

test('settings survive a reload with private file permissions', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ispadmin-test-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const file = join(dir, 'settings.json');
  const store = createSettingsStore(file);
  assert.equal(await store.load(), null);
  await store.save({baseUrl: 'https://isp.example', token: 'test-secret'});
  await assert.rejects(store.save({baseUrl: 'http://bad.example', token: 'bad'}));
  assert.deepEqual(await createSettingsStore(file).load(), {baseUrl: 'https://isp.example/api/v1/', token: 'test-secret'});
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test('configuration form checks invoice-only access without echoing the token', async t => {
  const store = {load: async () => ({baseUrl: 'https://isp.example', token: 'test-secret'})};
  const server = await startAdminServer({store, port: 0, fetchImpl: async url => {
    if (url.pathname.endsWith('/invoices/42')) return Response.json({id: 42});
    if (url.pathname.endsWith('/internet')) return Response.json({data: 'x'.repeat(256 * 1024)});
    return new Response(null, {status: 403});
  }});
  t.after(() => server.close());
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = (invoiceId, requestOrigin = origin) => fetch(origin, {
    method: 'POST', headers: {Origin: requestOrigin},
    body: new URLSearchParams({baseUrl: 'https://isp.example', token: 'test-secret', action: 'verify', invoiceId}),
  });
  assert.equal((await post('', 'https://other.example')).status, 403);
  const partial = await (await post('')).text();
  assert.match(partial, /Fatture: verifica da eseguire/);
  assert.match(partial, /Servizi: accesso verificato/);
  assert.doesNotMatch(partial, /test-secret/);
  const complete = await (await post('42')).text();
  assert.match(complete, /Fatture: accesso verificato/);
  assert.doesNotMatch(complete, /test-secret/);
});
