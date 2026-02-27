import { FactCluster } from './cluster';

export interface RankedFact {
  text: string;
  sessionCount: number;
  totalSessions: number;
  confidence: number;
  pattern: string;
  score: number;
}

function recencyWeight(lastSeen: string | undefined): number {
  if (!lastSeen) return 0.5;
  const daysSince = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, 1 - daysSince / 30);
}

export function rankClusters(clusters: FactCluster[], totalSessions: number): RankedFact[] {
  const ranked: RankedFact[] = clusters.map(cluster => {
    const weight = recencyWeight(cluster.lastSeen || undefined);
    const score = (cluster.sessionCount / totalSessions) * weight;
    return {
      text: cluster.representative,
      sessionCount: cluster.sessionCount,
      totalSessions,
      confidence: Math.max(...cluster.facts.map(f => f.confidence)),
      pattern: cluster.pattern,
      score,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
