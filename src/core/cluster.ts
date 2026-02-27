import { Fact } from './extractor';

export interface FactCluster {
  facts: Fact[];
  sessionCount: number;
  lastSeen: string;
  representative: string;
  pattern: string;
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function clusterFacts(facts: Fact[], threshold = 0.6, minSessionCount = 2): FactCluster[] {
  const clusters: FactCluster[] = [];

  for (const fact of facts) {
    let found = false;
    for (const cluster of clusters) {
      if (jaccard(cluster.representative, fact.text) > threshold) {
        cluster.facts.push(fact);
        // update representative to highest confidence
        if (fact.confidence > (cluster.facts.reduce((best, f) =>
          f.text === cluster.representative ? f.confidence : best, 0))) {
          cluster.representative = fact.text;
          cluster.pattern = fact.pattern;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push({
        facts: [fact],
        sessionCount: 0, // computed below
        lastSeen: fact.timestamp || '',
        representative: fact.text,
        pattern: fact.pattern,
      });
    }
  }

  // compute sessionCount and lastSeen
  for (const cluster of clusters) {
    const sessions = new Set(cluster.facts.map(f => f.sessionId));
    cluster.sessionCount = sessions.size;

    const timestamps = cluster.facts
      .map(f => f.timestamp)
      .filter((t): t is string => !!t)
      .sort();
    cluster.lastSeen = timestamps.length > 0 ? timestamps[timestamps.length - 1] : '';

    // update representative to fact with highest confidence
    let bestConfidence = 0;
    for (const fact of cluster.facts) {
      if (fact.confidence > bestConfidence) {
        bestConfidence = fact.confidence;
        cluster.representative = fact.text;
        cluster.pattern = fact.pattern;
      }
    }
  }

  // filter clusters below minSessionCount
  return clusters.filter(c => c.sessionCount >= minSessionCount);
}

export { jaccard };
