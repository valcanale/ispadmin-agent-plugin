import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {validateSettings} from './ispadmin.mjs';

export function createSettingsStore(path) {
  return {
    async load() {
      try {
        return validateSettings(JSON.parse(await readFile(path, 'utf8')));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async save(settings) {
      const data = validateSettings(settings);
      await mkdir(dirname(path), {recursive: true, mode: 0o700});
      const temp = path + '.' + randomUUID();
      try {
        await writeFile(temp, JSON.stringify(data), {mode: 0o600, flag: 'wx'});
        await rename(temp, path);
      } finally {
        await rm(temp, {force: true});
      }
    },
  };
}
