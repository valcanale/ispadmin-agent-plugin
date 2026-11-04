import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBaseUrl, createIspAdminClient} from '../src/ispadmin.mjs';

test('accepts a root or API v1 URL and rejects unsafe URLs', () => {
  for (const path of ['', '/', '/api/v1', '/api/v1/']) {
    assert.equal(normalizeBaseUrl('https://isp.example' + path), 'https://isp.example/api/v1/');
  }
  for (const url of ['http://isp.example', 'https://u:p@isp.example', 'https://isp.example/?', 'https://isp.example/#', 'https://isp.example/other']) {
    assert.throws(() => normalizeBaseUrl(url));
  }
});

test('uses a fixed read route and the ISPAdmin token header', async () => {
  const client = createIspAdminClient({baseUrl: 'https://isp.example', token: 'test-secret'}, async (url, options) => {
    assert.equal(url.href, 'https://isp.example/api/v1/clients?name=A%26B');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Token, 'test-secret');
    assert.equal(options.redirect, 'error');
    return Response.json([{id: 1, echo: 'test-secret'}]);
  });
  assert.deepEqual(await client.get('list_clients', {name: 'A&B'}), [{id: 1, echo: '[redacted]'}]);
  await assert.rejects(client.get('get_client', {id: '../tasks'}));
  await assert.rejects(client.get('list_clients', {limit: 2}));
});

test('reports upstream errors without exposing the response body', async () => {
  const client = createIspAdminClient({baseUrl: 'https://isp.example', token: 'test-secret'},
    async () => new Response('secret upstream body', {status: 403}));
  await assert.rejects(client.get('get_invoice', {id: 4}), {status: 403, message: 'Permessi ISPAdmin insufficienti.'});
});

test('rejects oversized upstream data', async () => {
  const client = createIspAdminClient({baseUrl: 'https://isp.example', token: 'test-secret'},
    async () => Response.json({data: 'x'.repeat(256 * 1024)}));
  await assert.rejects(client.get('list_internet_services'), /risposta ISPAdmin troppo grande/i);
});
