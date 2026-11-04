---
name: ispadmin-setup
description: Help an operator connect Codex to their self-hosted ISPAdmin MCP server and verify read-only access.
---

Ask for the deployment's HTTPS MCP endpoint if needed. The endpoint ends in `/mcp` and belongs to the plugin server. The ISPAdmin URL and token are entered in the operator's local browser form. Never ask for credentials in chat.

Use the repository README for deployment and OAuth setup. For Codex, the operator can register the endpoint with `codex mcp add ispadmin --url <MCP-URL>` and sign in through the OAuth provider. Start a new chat and verify access with a narrow read-only request, such as retrieving a known client ID. Use only the registered ISPAdmin MCP tools for live ISPAdmin data.
