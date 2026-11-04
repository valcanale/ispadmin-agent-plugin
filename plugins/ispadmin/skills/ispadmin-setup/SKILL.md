---
name: ispadmin-setup
description: Help an operator connect Codex to their self-hosted ISPAdmin MCP server and verify read-only access.
---

For initial setup, explain that Codex’s Manage page manages the package. Direct the operator to the repository’s browser setup instructions. From an up-to-date clone, run `npm ci` and `npm run setup` to open the form at `http://127.0.0.1:8765/` without OAuth. Stop setup before starting the complete server on the same port.

Ask for the deployment's HTTPS MCP endpoint if needed. The endpoint ends in `/mcp` and belongs to the plugin server. The ISPAdmin URL and token are entered in the operator's local browser form. Never ask for credentials in chat.

Use the repository README for deployment and OAuth setup. For Codex, the operator can register the endpoint with `codex mcp add ispadmin --url <MCP-URL>` and sign in through the OAuth provider. Start a new chat and verify access with a narrow read-only request, such as retrieving a known client ID. Use only the registered ISPAdmin MCP tools for live ISPAdmin data.
