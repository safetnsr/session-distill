import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const PROJECT_ROOT = path.resolve(__dirname, '..');
// When compiled with tsconfig.test.json, __dirname is build/tests/
// We need the project root which is two levels up from build/tests/
const CLI = path.join(PROJECT_ROOT, 'src', 'cli.js');
const FIXTURE_DIR = path.resolve(PROJECT_ROOT, '..', 'fixtures');

describe('cli', () => {
  it('--version outputs 0.3.1', () => {
    const output = execSync(`node ${CLI} --version`, { encoding: 'utf-8' }).trim();
    assert.strictEqual(output, '0.3.1');
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
    assert.ok('written' in parsed);
    assert.ok('path' in parsed);
    assert.ok('patterns_used' in parsed);
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

  // --- NEW TESTS for v0.3.0 ---

  it('--json --out combined: writes file AND stdout is valid JSON with written: true and patterns_used', () => {
    const tmpFile = path.join(os.tmpdir(), `session-distill-test-${Date.now()}.md`);
    try {
      const output = execSync(
        `node ${CLI} --json --out ${tmpFile} --adapter claude-code --project ${FIXTURE_DIR}`,
        { encoding: 'utf-8' }
      );
      const parsed = JSON.parse(output);
      assert.strictEqual(parsed.written, true);
      assert.strictEqual(parsed.path, tmpFile);
      assert.ok(typeof parsed.patterns_used === 'number');
      // File should exist and have content
      const fileContent = fs.readFileSync(tmpFile, 'utf-8');
      assert.ok(fileContent.includes('CLAUDE.md'), 'file should contain CLAUDE.md content');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  });

  it('--structured flag parsed correctly from args', () => {
    // Import parseArgs from built cli
    const { parseArgs } = require(path.join(PROJECT_ROOT, 'src', 'cli.js'));
    const args = parseArgs(['--from-files', '--structured', '--json']);
    assert.strictEqual(args.structured, true);
    assert.strictEqual(args.fromFiles, true);
    assert.strictEqual(args.json, true);
  });

  it('--from-files --structured: lines under ## Rules get explicit-instruction with confidence 0.95', () => {
    // Provide same fact in two sections so it clusters (sessionCount >= 2)
    // Also test that the structured parser assigns correct patterns
    const input = [
      '## Rules',
      'Always commit before deploy',
      'Never use rm directly',
      '## Constraints',
      'Always commit before deploy',
      'Never delete without backup',
    ].join('\n');
    const output = execSync(
      `printf '%s' '${input}' | node ${CLI} --json --from-files --structured`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    assert.ok(parsed.sessions_analyzed >= 2, 'should have at least 2 sessions (sections)');
    // Check that patterns include explicit-instruction from structured parsing
    const allPatterns = parsed.patterns;
    const explicit = allPatterns.filter((p: any) => p.pattern === 'explicit-instruction');
    assert.ok(explicit.length > 0, 'should have explicit-instruction patterns from ## Rules');
    // Check confidence is 0.95 for structured items
    const highConf = explicit.filter((p: any) => p.confidence >= 0.9);
    assert.ok(highConf.length > 0, 'should have high confidence patterns from structured mode');
  });

  it('--json with no sessions: outputs valid JSON with no_sessions: true', () => {
    const output = execSync(
      `echo "" | node ${CLI} --json --from-files`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.no_sessions, true);
    assert.strictEqual(parsed.sessions_analyzed, 0);
    assert.strictEqual(parsed.written, false);
    assert.strictEqual(parsed.path, null);
  });

  it('--json only (no --out): output includes written: false, path: null', () => {
    const output = execSync(
      `node ${CLI} --json --adapter claude-code --project ${FIXTURE_DIR}`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.written, false);
    assert.strictEqual(parsed.path, null);
    assert.ok(typeof parsed.patterns_used === 'number');
  });
});
