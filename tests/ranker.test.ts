import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { rankClusters, RankedFact } from '../src/core/ranker';
import { FactCluster } from '../src/core/cluster';

describe('ranker', () => {
  it('higher sessionCount → higher rank', () => {
    const clusters: FactCluster[] = [
      {
        facts: [
          { text: 'low count', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
          { text: 'low count', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
        ],
        sessionCount: 2,
        lastSeen: new Date().toISOString(),
        representative: 'low count',
        pattern: 'explicit-instruction',
      },
      {
        facts: [
          { text: 'high count', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
          { text: 'high count', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
          { text: 'high count', pattern: 'explicit-instruction', sessionId: 's3', confidence: 0.9 },
          { text: 'high count', pattern: 'explicit-instruction', sessionId: 's4', confidence: 0.9 },
          { text: 'high count', pattern: 'explicit-instruction', sessionId: 's5', confidence: 0.9 },
        ],
        sessionCount: 5,
        lastSeen: new Date().toISOString(),
        representative: 'high count',
        pattern: 'explicit-instruction',
      },
    ];
    const ranked = rankClusters(clusters, 10);
    assert.strictEqual(ranked[0].text, 'high count');
  });

  it('more recent → higher rank at same sessionCount', () => {
    const clusters: FactCluster[] = [
      {
        facts: [
          { text: 'old fact', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
          { text: 'old fact', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
        ],
        sessionCount: 2,
        lastSeen: '2026-01-01T00:00:00Z',
        representative: 'old fact',
        pattern: 'explicit-instruction',
      },
      {
        facts: [
          { text: 'recent fact', pattern: 'explicit-instruction', sessionId: 's3', confidence: 0.9 },
          { text: 'recent fact', pattern: 'explicit-instruction', sessionId: 's4', confidence: 0.9 },
        ],
        sessionCount: 2,
        lastSeen: new Date().toISOString(),
        representative: 'recent fact',
        pattern: 'explicit-instruction',
      },
    ];
    const ranked = rankClusters(clusters, 10);
    assert.strictEqual(ranked[0].text, 'recent fact');
  });

  it('output is sorted descending by score', () => {
    const clusters: FactCluster[] = [];
    for (let i = 1; i <= 5; i++) {
      const facts = [];
      for (let j = 0; j < i; j++) {
        facts.push({ text: `fact-${i}`, pattern: 'explicit-instruction' as const, sessionId: `s${j}`, confidence: 0.9 });
      }
      clusters.push({
        facts,
        sessionCount: i,
        lastSeen: new Date().toISOString(),
        representative: `fact-${i}`,
        pattern: 'explicit-instruction',
      });
    }
    const ranked = rankClusters(clusters, 10);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].score >= ranked[i].score, 'should be sorted descending');
    }
  });
});
