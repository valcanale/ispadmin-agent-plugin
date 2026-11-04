import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('advertises the settings action and saves the connection without returning the token', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ispadmin-local-test-'));
  const file = join(dir, 'settings.json');
  const client = new Client({name: 'test', version: '1.0.0'});
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: ['src/local.mjs'], env: {ISPADMIN_SETTINGS_FILE: file},
    }));
    const {readTool} = client.getServerCapabilities().experimental['openai/settings'];
    const settings = await client.callTool({name: readTool, arguments: {}});
    const action = settings.structuredContent.layout[0].items[0].tool;
    const {tools} = await client.listTools();
    const resourceUri = tools.find(tool => tool.name === action)._meta.ui.resourceUri;
    const {contents} = await client.readResource({uri: resourceUri});
    assert.match(contents[0].text, /type="password"/);
    assert.deepEqual(tools.find(tool => tool.name === 'ispadmin_save_connection')._meta.ui.visibility, ['app']);
    const saved = await client.callTool({name: 'ispadmin_save_connection', arguments: {
      baseUrl: 'https://ispadmin.example', token: 'test-secret',
    }});
    assert.deepEqual(saved.structuredContent, {status: 'ok'});
    assert.equal(JSON.parse(await readFile(file, 'utf8')).baseUrl, 'https://ispadmin.example/api/v1/');
    const configured = await client.callTool({name: action, arguments: {}});
    assert.deepEqual(configured.structuredContent, {status: 'ok', baseUrl: 'https://ispadmin.example'});
    assert.doesNotMatch(JSON.stringify([saved, configured]), /test-secret/);
  } finally {
    await client.close();
    await rm(dir, {recursive: true, force: true});
  }
});
