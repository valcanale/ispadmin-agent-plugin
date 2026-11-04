import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('setup starts the browser form without OAuth settings', {timeout: 5000}, async t => {
  const child = spawn(process.execPath, ['src/main.mjs', '--setup'], {
    env: {ISPADMIN_ADMIN_PORT: '0', ISPADMIN_SETTINGS_FILE: `/tmp/ispadmin-test-${process.pid}-nonexistent`},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  const address = await Promise.race([
    once(child.stdout, 'data').then(([data]) => data.toString().match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]),
    once(child, 'exit').then(([code]) => assert.fail('Setup exited with status ' + code)),
  ]);
  assert.ok(address);
  const res = await fetch(address);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /type="password"/);
});
