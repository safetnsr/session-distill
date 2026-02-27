import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { clusterFacts, FactCluster } from '../src/core/cluster';
import { Fact } from '../src/core/extractor';

describe('cluster', () => {
  it('clusters two identical facts', () => {
    const facts: Fact[] = [
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
    ];
    const clusters = clusterFacts(facts);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].sessionCount, 2);
  });

  it('clusters two similar facts (Jaccard > 0.6)', () => {
    // Words > 2 chars: "always", "use", "typescript", "for", "everything"/"this"/"project"
    // But "use" and "for" are 3 chars, so they pass filter
    // Set A: {always, use, typescript, for, everything} — 5 words
    // Set B: {always, use, typescript, for, this, project} — 6 words
    // Intersection: {always, use, typescript, for} = 4
    // Union: {always, use, typescript, for, everything, this, project} = 7
    // Jaccard = 4/7 = 0.57 — just below 0.6
    // Need higher similarity. Let's use closer strings.
    const facts: Fact[] = [
      { text: 'always use typescript for everything we build', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
      { text: 'always use typescript for everything we create', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
    ];
    // Words > 2 chars: A={always, use, typescript, for, everything, build} B={always, use, typescript, for, everything, create}
    // Intersection: {always, use, typescript, for, everything} = 5
    // Union: {always, use, typescript, for, everything, build, create} = 7
    // Jaccard = 5/7 = 0.71 > 0.6 ✓
    const clusters = clusterFacts(facts);
    assert.strictEqual(clusters.length, 1);
  });

  it('does NOT cluster two unrelated facts', () => {
    const facts: Fact[] = [
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
      { text: 'deploy to vercel after build', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
      { text: 'deploy to vercel after build', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
    ];
    const clusters = clusterFacts(facts);
    assert.ok(clusters.length >= 2, `expected at least 2 clusters, got ${clusters.length}`);
  });

  it('computes sessionCount correctly', () => {
    const facts: Fact[] = [
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's2', confidence: 0.9 },
      { text: 'always use typescript', pattern: 'explicit-instruction', sessionId: 's3', confidence: 0.9 },
    ];
    const clusters = clusterFacts(facts);
    assert.strictEqual(clusters[0].sessionCount, 3);
  });

  it('filters clusters with sessionCount < 2', () => {
    const facts: Fact[] = [
      { text: 'one time only fact', pattern: 'explicit-instruction', sessionId: 's1', confidence: 0.9 },
    ];
    const clusters = clusterFacts(facts);
    assert.strictEqual(clusters.length, 0);
  });
});
