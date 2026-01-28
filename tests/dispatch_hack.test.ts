import { execSync } from 'child_process';
import { describe, it } from 'vitest';

describe('Dispatch Hack', () => {
  it('runs the dispatch script', () => {
    try {
        // Use absolute path or relative to CWD. Vitest runs from root.
        execSync('./scripts/dispatch_agent.sh voidlock-xt7a', { stdio: 'inherit', cwd: process.cwd() });
    } catch (e) {
        console.error("Dispatch failed", e);
        throw e;
    }
  });
});
