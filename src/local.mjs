import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {registerTools} from './mcp.mjs';
import {createSettingsStore} from './settings.mjs';

const store = createSettingsStore(process.env.ISPADMIN_SETTINGS_FILE ??
  join(homedir(), '.config', 'ispadmin-agent-plugin', 'settings.json'));
const server = registerTools({store, local: true});
const ui = 'ui://ispadmin/configure.html';
const appOnly = {ui: {visibility: ['app']}};
const readTool = 'ispadmin_settings_read';
const updateTool = 'ispadmin_settings_update';
const values = z.object({});
const status = {status: z.string()};

server.server.registerCapabilities({experimental: {'openai/settings': {readTool, updateTool}}});
server.registerTool(readTool, {
  inputSchema: {},
  outputSchema: {
    schema: z.object({type: z.literal('object'), properties: values}),
    values,
    layout: z.array(z.object({
      kind: z.literal('group'), title: z.string(),
      items: z.array(z.object({kind: z.literal('tool'), tool: z.string()})),
    })),
  },
  annotations: {readOnlyHint: true},
  _meta: appOnly,
}, async () => ({
  content: [],
  structuredContent: {
    schema: {type: 'object', properties: {}},
    values: {},
    layout: [{kind: 'group', title: 'Collegamento ISPAdmin',
      items: [{kind: 'tool', tool: 'ispadmin_configure'}]}],
  },
}));
server.registerTool(updateTool, {
  inputSchema: {set: z.record(z.string(), z.unknown())},
  outputSchema: {...status, values},
  _meta: appOnly,
}, async ({set}) => ({
  content: [],
  structuredContent: {status: Object.keys(set).length ? 'unsupported' : 'ok', values: {}},
}));
server.registerTool('ispadmin_configure', {
  title: 'Configura ISPAdmin',
  inputSchema: {},
  outputSchema: {...status, baseUrl: z.string()},
  annotations: {readOnlyHint: true},
  _meta: {ui: {...appOnly.ui, resourceUri: ui}},
}, async () => {
  const saved = await store.load();
  return {content: [], structuredContent: {status: 'ok', baseUrl: saved ? new URL(saved.baseUrl).origin : ''}};
});
server.registerTool('ispadmin_save_connection', {
  inputSchema: {baseUrl: z.string().max(2048), token: z.string().max(1024)},
  outputSchema: status,
  annotations: {readOnlyHint: false},
  _meta: appOnly,
}, async settings => {
  try {
    await store.save(settings);
    return {content: [], structuredContent: {status: 'ok'}};
  } catch {
    return {isError: true, content: [{type: 'text', text: 'Impossibile salvare la configurazione.'}]};
  }
});
server.registerResource('Configurazione ISPAdmin', ui, {mimeType: 'text/html;profile=mcp-app'},
  async () => ({
    contents: [{uri: ui, mimeType: 'text/html;profile=mcp-app',
      text: await readFile(new URL('../apps/configure.html', import.meta.url), 'utf8')}],
  }));
await server.connect(new StdioServerTransport());
