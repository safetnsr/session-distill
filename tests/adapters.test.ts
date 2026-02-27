import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { parseClaudeCode } from '../src/adapters/claude-code';
import { parseAider } from '../src/adapters/aider';

const PROJECT_ROOT = path.resolve(__dirname, '..');
// When compiled: __dirname = build/tests/, project root = build/, fixtures at ../../fixtures
const FIXTURE_DIR = path.resolve(PROJECT_ROOT, '..', 'fixtures');

describe('adapters', () => {
  it('claude-code adapter parses JSONL correctly', () => {
    const messages = parseClaudeCode(FIXTURE_DIR, 20);
    assert.ok(messages.length > 0, `should parse messages from fixture, got ${messages.length}`);
    const humanMessages = messages.filter(m => m.role === 'human');
    assert.ok(humanMessages.length > 0, 'should have human messages');
    assert.ok(humanMessages.some(m => m.content.includes('typescript')));
  });

  it('aider adapter parses markdown format correctly', () => {
    const fixturePath = path.join(FIXTURE_DIR, 'aider-history.md');
    const messages = parseAider(fixturePath);
    assert.ok(messages.length > 0, 'should parse messages from aider fixture');
    const humanMessages = messages.filter(m => m.role === 'human');
    assert.ok(humanMessages.length >= 2, `should have at least 2 human messages, got ${humanMessages.length}`);
    assert.ok(humanMessages.some(m => m.content.includes('typescript')));
  });

  it('autoDetect returns null when no agent found', async () => {
    const { autoDetect } = await import('../src/adapters/index');
    const origHome = process.env.HOME;
    const origIsTTY = process.stdin.isTTY;
    process.env.HOME = '/tmp/nonexistent-home-for-test';
    // Force isTTY to true so stdin adapter doesn't trigger
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    const result = await autoDetect('/tmp/nonexistent-dir-for-test');
    process.env.HOME = origHome;
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
    assert.strictEqual(result, null);
  });
});
