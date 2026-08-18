import { runSunReyDev } from './cli.ts';

const output = await runSunReyDev(['sunrey-dev', ...process.argv.slice(2)]);
console.log(output);
if (output.startsWith('error:')) {
  process.exitCode = 1;
}
