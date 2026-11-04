import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSONRPCMessageSchema} from '@modelcontextprotocol/sdk/types.js';

test('the configuration iframe sends a valid initialized notification over postMessage', async () => {
  const html = await readFile(new URL('../apps/configure.html', import.meta.url), 'utf8');
  const messages = [];
  const parent = {postMessage: message => messages.push(structuredClone(message))};
  const listeners = {};
  const button = {disabled: true};
  const form = {querySelector: () => button, addEventListener() {}};
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document: {querySelector: selector => selector === 'form' ? form : {}, getElementById: () => ({})},
    window: {parent, addEventListener: (name, handler) => {listeners[name] = handler;}},
    setTimeout, clearTimeout,
  });
  const init = JSONRPCMessageSchema.parse(messages[0]);
  listeners.message({source: parent, data: {jsonrpc: '2.0', id: init.id, result: {}}});
  await Promise.resolve();
  assert.deepEqual(messages[1], {jsonrpc: '2.0', method: 'ui/notifications/initialized'});
  JSONRPCMessageSchema.parse(messages[1]);
  assert.equal(button.disabled, false);
});
