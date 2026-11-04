# ISPAdmin Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the four approved ISPAdmin read-only areas with browser configuration, ChatGPT connection, and GitHub marketplace installation in Codex.

**Architecture:** One service per ISPAdmin instance. A loopback-only configuration listener and an authenticated Streamable HTTP MCP listener share an atomic local configuration store and the same ISPAdmin client. ChatGPT and Codex connect to the operator's deployment.

**Tech Stack:** Node.js 22+, official MCP TypeScript SDK, Zod, jose, node:test, HTML form.

**Spec:** [Approved design](../specs/2026-11-04-ispadmin-plugin-design.md)

## Global Constraints

- One ISPAdmin token per deployment, supplied in the GUI and sent upstream as the Token header.
- Read-only clients, services, invoices and scheduling.
- OAuth protects MCP. The admin listener is separate and never forwarded through the MCP reverse proxy or tunnel.
- Credentials stay out of Git, MCP inputs, tool results, and logs.

## Review Focus

- A URL with a query, fragment, embedded credentials or unsafe scheme is rejected in Task 1.
- A redirect to another host cannot forward the token in Task 1.
- Invoice-only permissions give a verification result with an optional invoice ID in Task 2.
- Tokens for a different resource or identity cannot call tools in Task 3.
- A marketplace installed on a clean Codex profile can discover the package and reach the operator's configured server in Task 4.

### Task 1 — ISPAdmin client

**Files:** `package.json`, `package-lock.json`, `src/ispadmin.mjs`, `test/ispadmin.test.mjs`

- [ ] Obtain the official endpoint schemas. Record supported query names and pagination semantics for each list route before implementing its input schema.
- [ ] Write tests for URL normalization to `/api/v1/`, rejection of credentials, query, fragment and non-HTTPS URLs, exact GET paths and query serialization, and the `Token` header. Assert that redirects are rejected, output is bounded, and raw upstream errors are excluded. Run `node --test test/ispadmin.test.mjs` and confirm red.
- [ ] Implement `normalizeBaseUrl(value)` and `createIspAdminClient({baseUrl, token})` with `get(operation, args)`. Resolve operation keys through a fixed route table. Reject unsafe IDs and unknown arguments, set a request timeout, cap response bytes, distinguish upstream 401/403/404 and network errors, and remove the configured token if echoed upstream.
- [ ] Run the tests and commit after they pass.

### Task 2 — Browser setup and storage

**Files:** `src/settings.mjs`, `src/admin.mjs`, `test/admin.test.mjs`, `.gitignore`

- [ ] Write tests for a fresh settings store, successful save and reload, validation failure preserving the saved configuration, absent secrets in HTML responses, rejection of cross-origin submission and invoice-only test with and without a sample ID. Run `node --test test/admin.test.mjs` and confirm red.
- [ ] Implement `createSettingsStore(path)` with `load()` and `save(settings)`. Use a private directory and atomic file replacement with mode 0600. Persist outside the checkout by default.
- [ ] Implement `startAdminServer({store, port})`. Bind to loopback, validate Host and Origin, cap request sizes, serve the masked token and URL fields, and support separate Verify and Save actions. Verification uses documented GET probes and reports inconclusive access to invoices when the only available invoice operation requires a sample ID.
- [ ] Run all tests and commit after they pass.

### Task 3 — Authenticated MCP service

**Files:** `src/auth.mjs`, `src/mcp.mjs`, `src/main.mjs`, `test/mcp.test.mjs`

- [ ] Add integration tests using signed tokens and a simulated upstream. Assert expected tool names, exact GET requests, 401 for missing or invalid credentials, rejection of wrong issuer/audience and unauthorized subjects, rejected unsafe arguments, and no upstream call on failure. Run `node --test test/mcp.test.mjs` and confirm red.
- [ ] Implement `createAuthorizer({issuer, jwksUrl, resource, allowedSubjects})`. Verify signature, issuer, audience, expiration, subject and read scope. Publish protected-resource discovery and return the OAuth challenge with the configured resource metadata URL.
- [ ] Implement `startMcpServer({store, authorizer, resource, port})` using the official SDK and Streamable HTTP. Register typed read-only operations for clients, client services, internet services, invoices and tasks as defined in the spec. Load the current settings per call.
- [ ] Wire both listeners in `src/main.mjs`. Document deployment with an existing OAuth provider and the issuer, audience, client registration and callback requirements. Keep the configuration listener local.
- [ ] Run all tests and commit after they pass.

### Task 4 — GitHub marketplace and installation

**Files:** `.agents/plugins/marketplace.json`, `plugins/ispadmin/plugin.json`, `plugins/ispadmin/skills/ispadmin-setup/SKILL.md`, `README.md`, `LICENSE`

- [ ] Add the Codex marketplace catalog and plugin manifest with a stable `ispadmin` ID and setup skill. The setup points the operator to the browser form and explains how to register the deployment-specific MCP URL. It never requests the ISPAdmin token in chat.
- [ ] Document the marketplace flow and how to select and install ISPAdmin in Codex. Explain that the marketplace command adds the catalog, and each installation uses its own OAuth-enabled MCP endpoint. Document the separate ChatGPT web flow through Add custom MCP server. Include server setup, GUI configuration, OpenAI connectivity, one read-only example per area, and project license.
- [ ] Test catalog discovery and install in an isolated Codex profile. Exercise a real MCP tool call with a simulated ISPAdmin upstream and disclose any live-platform checks that require an operator's credentials.
- [ ] Run `npm test` and `git diff --check`. Commit after checks pass, push the implementation to GitHub, and verify that the remote marketplace can be added with the README commands.

```bash
codex plugin marketplace add valcanale/ispadmin-agent-plugin --ref main
codex plugin marketplace list
```
