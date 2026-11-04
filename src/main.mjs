import {homedir} from 'node:os';
import {join} from 'node:path';
import {startAdminServer} from './admin.mjs';
import {createSettingsStore} from './settings.mjs';
import {createAuthorizer} from './auth.mjs';
import {startMcpServer} from './mcp.mjs';

function port(value) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('Porta non valida.');
  }
  return Number(value);
}

async function main() {
  const {
    ISPADMIN_SETTINGS_FILE = join(homedir(), '.config', 'ispadmin-agent-plugin', 'settings.json'),
    ISPADMIN_ADMIN_PORT = '8765', ISPADMIN_MCP_PORT = '8766', ISPADMIN_MCP_URL: resource,
    ISPADMIN_OAUTH_ISSUER: issuer, ISPADMIN_OAUTH_JWKS_URL: jwksUrl, ISPADMIN_OAUTH_SUBJECTS = '',
  } = process.env;
  const adminPort = port(ISPADMIN_ADMIN_PORT);
  const mcpPort = port(ISPADMIN_MCP_PORT);
  if (adminPort === mcpPort) throw new Error('Usa porte distinte per configurazione e MCP.');
  const store = createSettingsStore(ISPADMIN_SETTINGS_FILE);
  const allowedSubjects = ISPADMIN_OAUTH_SUBJECTS.split(',').map(value => value.trim()).filter(Boolean);
  const authorizer = createAuthorizer({issuer, jwksUrl, resource, allowedSubjects});
  const admin = await startAdminServer({store, port: adminPort});
  try {
    await startMcpServer({store, authorizer, resource, port: mcpPort});
  } catch (error) {
    admin.close();
    throw error;
  }
  console.log(`Configurazione: http://127.0.0.1:${adminPort}/\nMCP: http://127.0.0.1:${mcpPort}/mcp`);
}

main().catch(() => {
  console.error('Avvio non riuscito. Controlla porte, URL MCP e impostazioni OAuth nel README.');
  process.exitCode = 1;
});
