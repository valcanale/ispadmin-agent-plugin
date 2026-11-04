import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalJWKSet, exportJWK, generateKeyPair, SignJWT} from 'jose';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createAuthorizer} from '../src/auth.mjs';
import {startMcpServer} from '../src/mcp.mjs';

test('MCP enforces OAuth and invokes only documented read operations', async t => {
  const issuer = 'https://auth.example';
  const resource = 'https://plugin.example/mcp';
  const {publicKey, privateKey} = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const authorizer = createAuthorizer({
    issuer, resource, allowedSubjects: ['operator'], keySet: createLocalJWKSet({keys: [jwk]}),
  });
  const sign = ({audience = resource, subject = 'operator', scope = 'ispadmin:read'} = {}) =>
    new SignJWT({scope}).setProtectedHeader({alg: 'RS256'}).setSubject(subject)
      .setIssuer(issuer).setAudience(audience).setExpirationTime('1m').sign(privateKey);
  const calls = [];
  const server = await startMcpServer({
    port: 0, authorizer, resource,
    store: {load: async () => ({baseUrl: 'https://isp.example', token: 'isp-test-secret'})},
    fetchImpl: async (url, options) => {
      calls.push([url.pathname, options.method, options.headers.Token]);
      return Response.json({id: 42});
    },
  });
  t.after(() => server.close());
  const url = new URL('http://127.0.0.1:' + server.address().port + '/mcp');
  const meta = await (await fetch(new URL('/.well-known/oauth-protected-resource/mcp', url))).json();
  assert.equal(meta.resource, resource);
  for (const token of [null, await sign({audience: 'https://other.example'}), await sign({subject: 'unknown'}), await sign({scope: ''})]) {
    const res = await fetch(url, {method: 'POST', headers: token ? {Authorization: 'Bearer ' + token} : {}});
    assert.equal(res.status, token ? (await authorizer('Bearer ' + token)).status : 401);
    assert.ok([401, 403].includes(res.status));
  }
  assert.deepEqual(calls, []);
  const transport = new StreamableHTTPClientTransport(url, {requestInit: {headers: {Authorization: 'Bearer ' + await sign()}}});
  const client = new Client({name: 'test', version: '1'});
  t.after(() => client.close());
  await client.connect(transport);
  const {tools} = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'get_client', 'get_internet_service', 'get_invoice', 'get_task',
    'list_client_services', 'list_clients', 'list_internet_services', 'list_tasks',
  ]);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint));
  await client.callTool({name: 'get_invoice', arguments: {id: '../tasks'}});
  assert.deepEqual(calls, []);
  const examples = [
    ['list_clients', {name: 'Rossi'}, '/clients'],
    ['get_client', {id: 42}, '/clients/42'],
    ['list_client_services', {id: 42}, '/clients/42/services'],
    ['list_internet_services', {}, '/internet'],
    ['get_internet_service', {id: 42}, '/internet/42'],
    ['get_invoice', {id: 42}, '/invoices/42'],
    ['list_tasks', {complete: '0'}, '/tasks'],
    ['get_task', {id: '42'}, '/tasks/42'],
  ];
  for (const [name, args, path] of examples) {
    const result = await client.callTool({name, arguments: args});
    assert.equal(result.isError ?? false, false, name);
    assert.doesNotMatch(JSON.stringify(result), /isp-test-secret/);
    assert.deepEqual(calls.pop(), ['/api/v1' + path, 'GET', 'isp-test-secret']);
  }
  assert.deepEqual(calls, []);
});
