import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { execSync } from 'child_process';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
// When compiled with tsconfig.test.json, __dirname is build/tests/
// We need the project root which is two levels up from build/tests/
const CLI = path.join(PROJECT_ROOT, 'src', 'cli.js');
const FIXTURE_DIR = path.resolve(PROJECT_ROOT, '..', 'fixtures');

describe('cli', () => {
  it('--version outputs 0.1.0', () => {
    const output = execSync(`node ${CLI} --version`, { encoding: 'utf-8' }).trim();
    assert.strictEqual(output, '0.1.0');
  });

  it('--help outputs usage', () => {
    const output = execSync(`node ${CLI} --help`, { encoding: 'utf-8' });
    assert.ok(output.includes('session-distill'));
    assert.ok(output.includes('usage:'));
  });

  it('--json outputs valid JSON with correct shape', () => {
    const output = execSync(
      `node ${CLI} --json --adapter claude-code --project ${FIXTURE_DIR}`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    assert.ok('sessions_analyzed' in parsed);
    assert.ok('patterns' in parsed);
    assert.ok('claude_md' in parsed);
    assert.ok(Array.isArray(parsed.patterns));
  });

  it('--top 3 outputs max 3 patterns', () => {
    const output = execSync(
      `node ${CLI} --top 3 --adapter claude-code --project ${FIXTURE_DIR}`,
      { encoding: 'utf-8' }
    );
    const lines = output.split('\n').filter(l => l.match(/^\s+\d+\./));
    assert.ok(lines.length <= 3, `expected max 3 lines, got ${lines.length}`);
  });
});
