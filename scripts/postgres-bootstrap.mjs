import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bootstrapPersistence,
  persistenceEnvFromProcess,
} from '../packages/persistence/src/index.ts';

const env = persistenceEnvFromProcess();
await bootstrapPersistence(env);
console.log('PostgreSQL roles and bounded-domain databases are ready.');
