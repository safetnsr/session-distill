import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { extractFacts, Message } from '../src/core/extractor';

describe('extractor', () => {
  it('picks up explicit instructions', () => {
    const messages: Message[] = [
      { role: 'human', content: 'always use typescript', sessionId: 's1' },
    ];
    const facts = extractFacts(messages);
    const explicit = facts.filter(f => f.pattern === 'explicit-instruction');
    assert.ok(explicit.length > 0, 'should find explicit instruction');
    assert.ok(explicit.some(f => f.text.includes('always use typescript')));
  });

  it('picks up stack mentions for allowlisted terms', () => {
    const messages: Message[] = [
      { role: 'human', content: 'we are using typescript and react', sessionId: 's1' },
    ];
    const facts = extractFacts(messages);
    const stacks = facts.filter(f => f.pattern === 'stack-mention');
    assert.ok(stacks.some(f => f.text === 'typescript'));
    assert.ok(stacks.some(f => f.text === 'react'));
  });

  it('does NOT pick up non-allowlisted terms as stack', () => {
    const messages: Message[] = [
      { role: 'human', content: 'I love coffee and pizza', sessionId: 's1' },
    ];
    const facts = extractFacts(messages);
    const stacks = facts.filter(f => f.pattern === 'stack-mention');
    assert.strictEqual(stacks.length, 0);
  });

  it('picks up corrections', () => {
    const messages: Message[] = [
      { role: 'human', content: 'no, we use npm not pip', sessionId: 's1' },
    ];
    const facts = extractFacts(messages);
    const corrections = facts.filter(f => f.pattern === 'correction');
    assert.ok(corrections.length > 0, 'should find correction');
  });

  it('caps at 50 facts per session', () => {
    const messages: Message[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({
        role: 'human',
        content: `always do thing number ${i} in the special way ${i}`,
        sessionId: 's1',
      });
    }
    const facts = extractFacts(messages);
    const s1Facts = facts.filter(f => f.sessionId === 's1');
    assert.ok(s1Facts.length <= 50, `should cap at 50, got ${s1Facts.length}`);
  });

  it('deduplicates within same session', () => {
    const messages: Message[] = [
      { role: 'human', content: 'always use typescript', sessionId: 's1' },
      { role: 'human', content: 'always use typescript', sessionId: 's1' },
    ];
    const facts = extractFacts(messages);
    const matching = facts.filter(f => f.text === 'always use typescript');
    assert.strictEqual(matching.length, 1);
  });
});
