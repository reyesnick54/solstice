import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const BIN = join(ROOT, 'packages/sunrey-chain/rust/target/debug/sunrey-node');

function run(args: string[], dataDir?: string): string {
  const all = dataDir ? [...args, '--data-dir', dataDir] : args;
  const result = spawnSync(BIN, all, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function build(): void {
  const result = spawnSync('cargo', ['build', '-p', 'sunrey-rpc', '--bin', 'sunrey-node'], {
    cwd: join(ROOT, 'packages/sunrey-chain/rust'),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`cargo build failed: ${result.stderr}`);
  }
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('no port'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitHealth(addr: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${addr}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until deadline
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('node was not ready');
}

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey local development / simulation blockchain demo');
  console.log('ENVIRONMENT=simulation  role=LOCAL_DEVELOPMENT_SIMULATION');
  console.log('producer=DEV_BLOCK_PRODUCER  (not production BFT)');
  console.log('============================================================');
  build();
  const dataDir = mkdtempSync(join(tmpdir(), 'sunrey-demo-'));
  const port = await freePort();
  const listen = `127.0.0.1:${port}`;
  try {
    console.log(run(['init'], dataDir));
    const child = spawn(BIN, ['run', '--data-dir', dataDir, '--listen', listen], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitHealth(listen);
    const hex = run(['encode-fixture', '--name', 'system-note']).trim();
    const submitted = await fetch(`http://${listen}/tx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hex }),
    });
    console.log('submit', await submitted.json());
    const produced = await fetch(`http://${listen}/admin/produce-block`, { method: 'POST', body: '{}' });
    const block = (await produced.json()) as { height: number; block_id: string; app_hash: string };
    console.log('produced', block);
    const queried = await fetch(`http://${listen}/block/height/${block.height}`);
    console.log('block', await queried.json());
    const tx = await fetch(`http://${listen}/tx/${(block as { tx_ids?: string[] }).tx_ids?.[0] ?? ''}`);
    if ((block as { tx_ids?: string[] }).tx_ids?.[0]) {
      console.log('tx', await tx.json());
    }
    const status = (await (await fetch(`http://${listen}/status`)).json()) as { app_hash: string; height: number };
    console.log('state_root', status.app_hash);
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));

    const restarted = spawn(BIN, ['run', '--data-dir', dataDir, '--listen', listen], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitHealth(listen);
    const again = (await (await fetch(`http://${listen}/status`)).json()) as { app_hash: string; height: number };
    if (again.app_hash !== status.app_hash || again.height !== status.height) {
      throw new Error('restart state root mismatch');
    }
    console.log('restart verified state_root', again.app_hash);
    const second = await fetch(`http://${listen}/admin/produce-block`, { method: 'POST', body: '{}' });
    const next = (await second.json()) as { height: number; block_id: string };
    const parent = await fetch(`http://${listen}/block/height/${next.height}`);
    const parentJson = (await parent.json()) as { parent_block_id: string };
    if (parentJson.parent_block_id !== block.block_id) {
      throw new Error('block linkage mismatch');
    }
    console.log('second block linked to', block.block_id);
    restarted.kill('SIGTERM');
    await new Promise<void>((resolve) => restarted.once('exit', () => resolve()));
    console.log('demo ok — local development / simulation only');
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

await main();
