import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function read(name: string): string {
  return readFileSync(join(here, name), 'utf8');
}

describe('Account construction requires a validated Execution Authority', () => {
  it('Account has a private constructor and only fromValidatedAuthority constructs it', () => {
    const source = read('account.ts');
    assert.match(source, /private constructor\(/);
    assert.match(source, /static fromValidatedAuthority\(/);
    assert.match(source, /authority: ValidatedExecutionAuthority/);
    assert.equal((source.match(/new Account\(/g) ?? []).length, 1);
    assert.match(source, /fromValidatedAuthority[\s\S]*return new Account\(/);
  });

  it('fromValidatedAuthority requires ValidatedExecutionAuthority as its first argument', () => {
    const source = read('account.ts');
    const factory = source.match(
      /static fromValidatedAuthority\(\s*authority: ValidatedExecutionAuthority,/,
    );
    assert.ok(factory, 'fromValidatedAuthority must require ValidatedExecutionAuthority');
  });

  it('ValidatedExecutionAuthority can be produced only by verifyExecutionAuthority', () => {
    const verify = read('verify-authority.ts');
    assert.match(verify, /declare const validatedAuthorityBrand: unique symbol/);
    assert.match(
      verify,
      /export type ValidatedExecutionAuthority = ExecutionAuthority & \{/,
    );
    assert.match(verify, /return ok\(authority as ValidatedExecutionAuthority\)/);
    assert.doesNotMatch(verify, /export function asValidated/);
  });

  it('openAccount is the only service entry point and never constructs an Account without verify', () => {
    const source = read('open-account.ts');
    assert.match(source, /openAccount\(intent: ActionIntent\)/);
    assert.match(source, /this\.kernel\.submit\(intent\)/);
    assert.match(source, /verifyExecutionAuthority\(/);
    assert.match(source, /Account\.fromValidatedAuthority\(/);
    assert.doesNotMatch(source, /new Account\(/);
    const factoryIndex = source.indexOf('Account.fromValidatedAuthority(');
    const verifyIndex = source.indexOf('verifyExecutionAuthority(');
    assert.ok(verifyIndex >= 0 && factoryIndex > verifyIndex);
  });

  it('no exported helper constructs an Account from raw fields', () => {
    const index = read('index.ts');
    assert.doesNotMatch(index, /createAccount\b|openAccountUnchecked|new Account\(/);
    const account = read('account.ts');
    assert.doesNotMatch(account, /export function createAccount/);
    assert.doesNotMatch(account, /export function openAccount/);
  });
});
