import {createServer} from 'node:http';
import {once} from 'node:events';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {httpsUrl, readScope} from './auth.mjs';
import {createIspAdminClient, IspAdminError, operations} from './ispadmin.mjs';

function result(text, isError = false) {
  return {content: [{type: 'text', text}], isError};
}

export function registerTools({store, fetchImpl, local = false}) {
  const mcp = new McpServer({name: 'ispadmin', version: '0.2.0'});
  const securitySchemes = [{type: 'oauth2', scopes: [readScope]}];
  for (const [name, operation] of Object.entries(operations)) {
    mcp.registerTool(name, {
      description: operation.description,
      inputSchema: operation.input,
      annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true},
      ...(local ? {} : {_meta: {securitySchemes}}),
    }, async args => {
      try {
        const settings = await store.load();
        if (!settings) return result(local ? 'Apri Plugin → ISPAdmin → Configura ISPAdmin.' : 'Configura ISPAdmin nella maschera del server.', true);
        const data = await createIspAdminClient(settings, fetchImpl).get(name, args);
        return result(JSON.stringify(data));
      } catch (error) {
        return result(error instanceof IspAdminError ? error.message : 'Richiesta ISPAdmin non riuscita.', true);
      }
    });
  }
  return mcp;
}

export async function startMcpServer({store, authorizer, resource, port, fetchImpl}) {
  const url = httpsUrl(resource);
  if (url.pathname !== '/mcp') throw new Error('The public MCP resource must end in /mcp.');
  const metadataPath = '/.well-known/oauth-protected-resource/mcp';
  const metadataUrl = new URL(metadataPath, url).href;
  const server = createServer(async (req, res) => {
    if (req.headers.origin && req.headers.origin !== url.origin) return res.writeHead(403).end();
    if (req.method === 'GET' && [metadataPath, '/.well-known/oauth-protected-resource'].includes(req.url)) {
      return res.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify({
        resource, authorization_servers: [authorizer.issuer],
        scopes_supported: [readScope], bearer_methods_supported: ['header'],
      }));
    }
    if (req.url !== '/mcp') return res.writeHead(404).end();
    const auth = await authorizer(req.headers.authorization);
    if (auth.status !== 200) {
      const challenge = `Bearer resource_metadata="${metadataUrl}", scope="${readScope}"`;
      if (auth.status === 401 || auth.insufficientScope) {
        res.setHeader('WWW-Authenticate', challenge + (auth.insufficientScope ? ', error="insufficient_scope"' : ''));
      }
      return res.writeHead(auth.status, {'Cache-Control': 'no-store'}).end();
    }
    if (req.method !== 'POST') return res.writeHead(405, {Allow: 'POST'}).end();
    const mcp = registerTools({store, fetchImpl});
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
    res.once('close', () => { void mcp.close(); });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
