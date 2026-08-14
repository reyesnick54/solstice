import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bootstrapPersistence,
  migrateAll,
  persistenceEnvFromProcess,
} from '../packages/persistence/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = persistenceEnvFromProcess();
await bootstrapPersistence(env);
await migrateAll(env, root);
console.log('PostgreSQL migrations applied.');
