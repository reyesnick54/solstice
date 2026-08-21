import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPERATOR_ROUTES, PUBLIC_ROUTES } from './gateway/server.ts';
import { API_NAMESPACES, EVENT_TYPES } from './types.ts';
import { PUBLIC_API_VERSION } from './versioning.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const markdown = `# SunRey public API reference

Generated from the in-repo OpenAPI definitions and SDK route table.

- API version: \`${PUBLIC_API_VERSION}\`
- Public surface: \`PUBLIC_API\`
- Operator surface: \`OPERATOR_API\`

## Namespaces

${API_NAMESPACES.map((name) => `- ${name}`).join('\n')}

## Public routes

${PUBLIC_ROUTES.map((route) => `- \`${route}\``).join('\n')}

## Operator routes

${OPERATOR_ROUTES.map((route) => `- \`${route}\``).join('\n')}

## Event types

${EVENT_TYPES.map((name) => `- \`${name}\``).join('\n')}

## Developer platform (Chunk 94)

Control-plane routes live under \`/v1/developer\`. Specs:

Canonical specifications:

- \`api/sunrey-chain-v1.openapi.yaml\`
- \`api/sunrey-exchange-v1.openapi.yaml\`
- \`api/sunrey-events-v1.md\`
- \`api/sunrey-developer-platform-v1.openapi.yaml\`
- \`api/sunrey-consumer-platform-v1.openapi.yaml\`
- \`api/sunrey-webhooks-v1.json\`
`;

writeFileSync(join(root, 'docs/developers/api-reference.md'), markdown);
console.log('wrote docs/developers/api-reference.md');
