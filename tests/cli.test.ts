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
  it('--version outputs 0.2.0', () => {
    const output = execSync(`node ${CLI} --version`, { encoding: 'utf-8' }).trim();
    assert.strictEqual(output, '0.2.0');
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
    assert.ok('filtered_patterns' in parsed);
    assert.ok('no_sessions' in parsed);
    assert.ok('claude_md' in parsed);
    assert.ok(Array.isArray(parsed.patterns));
    assert.ok(Array.isArray(parsed.filtered_patterns));
  });

  it('filtered_patterns is subset of patterns with confidence >= 0.6 and sessionCount >= 2', () => {
    const output = execSync(
      `node ${CLI} --json --adapter claude-code --project ${FIXTURE_DIR}`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    for (const fp of parsed.filtered_patterns) {
      assert.ok(fp.confidence >= 0.6, `filtered pattern "${fp.text}" has confidence ${fp.confidence} < 0.6`);
      assert.ok(fp.sessionCount >= 2, `filtered pattern "${fp.text}" has sessionCount ${fp.sessionCount} < 2`);
      // must exist in patterns
      const found = parsed.patterns.find((p: any) => p.text === fp.text && p.pattern === fp.pattern);
      assert.ok(found, `filtered pattern "${fp.text}" not found in patterns`);
    }
  });

  it('no_sessions is true when sessions_analyzed is 0', () => {
    // Use --from-files with empty stdin to get 0 sessions
    const output = execSync(
      `echo "" | node ${CLI} --json --from-files`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    // With empty input, either no messages or 0 sessions
    if (parsed.sessions_analyzed === 0) {
      assert.strictEqual(parsed.no_sessions, true);
    }
  });

  it('--from-files flag is recognized', () => {
    // --from-files with piped content should work without error
    const output = execSync(
      `echo "always use typescript\nalways use typescript" | node ${CLI} --json --from-files`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    assert.ok('sessions_analyzed' in parsed);
    assert.ok('filtered_patterns' in parsed);
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
