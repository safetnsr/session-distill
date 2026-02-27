export interface Message {
  role: 'human' | 'assistant';
  content: string;
  sessionId: string;
  timestamp?: string;
}

export interface Fact {
  text: string;
  pattern: PatternType;
  sessionId: string;
  confidence: number;
  timestamp?: string;
}

export type PatternType =
  | 'explicit-instruction'
  | 'stack-mention'
  | 'convention'
  | 'correction'
  | 'repeated-answer';

const STACK_ALLOWLIST = new Set([
  'typescript', 'javascript', 'node', 'python', 'rust', 'go', 'java', 'kotlin',
  'react', 'vue', 'svelte', 'next.js', 'nextjs', 'remix', 'astro',
  'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'supabase',
  'vercel', 'railway', 'fly.io', 'aws', 'gcp', 'azure',
  'docker', 'kubernetes', 'terraform',
  'npm', 'pnpm', 'yarn', 'pip', 'cargo', 'bun',
  'tailwind', 'shadcn', 'prisma', 'drizzle',
  'openai', 'anthropic', 'claude', 'gemini',
  'github', 'gitlab', 'linear', 'jira', 'notion',
]);

const EXPLICIT_INSTRUCTION = /^(always|never|don't|do not|use |prefer |default to |remember |note:|important:|tip:)/i;
const CONVENTION = /\b(we use|we prefer|our convention|our stack|our workflow|we always|we never|our team)\b/i;
const CORRECTION = /^(no,|no |actually,|actually |wrong,|that's wrong|not quite|incorrect)/i;

export function extractFacts(messages: Message[]): Fact[] {
  const facts: Fact[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== 'human') continue;

    const lines = msg.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // check for correction at message level
    const firstLine = lines[0] || '';
    if (CORRECTION.test(firstLine)) {
      const correctionText = msg.content.replace(CORRECTION, '').trim();
      if (correctionText.length > 0) {
        const key = `${msg.sessionId}:${correctionText}`;
        if (!seen.has(key)) {
          seen.add(key);
          facts.push({
            text: correctionText,
            pattern: 'correction',
            sessionId: msg.sessionId,
            confidence: 0.8,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    for (const line of lines) {
      // stack mentions - word-level exact match
      const words = line.toLowerCase().split(/[\s,;:.()\[\]{}]+/).filter(w => w.length > 0);
      for (const word of words) {
        if (STACK_ALLOWLIST.has(word)) {
          const key = `${msg.sessionId}:stack:${word}`;
          if (!seen.has(key)) {
            seen.add(key);
            facts.push({
              text: word,
              pattern: 'stack-mention',
              sessionId: msg.sessionId,
              confidence: 0.7,
              timestamp: msg.timestamp,
            });
          }
        }
      }

      // explicit instruction
      if (EXPLICIT_INSTRUCTION.test(line)) {
        const key = `${msg.sessionId}:${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          facts.push({
            text: line,
            pattern: 'explicit-instruction',
            sessionId: msg.sessionId,
            confidence: 0.9,
            timestamp: msg.timestamp,
          });
        }
      }

      // convention
      if (CONVENTION.test(line)) {
        const key = `${msg.sessionId}:${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          facts.push({
            text: line,
            pattern: 'convention',
            sessionId: msg.sessionId,
            confidence: 0.85,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    // cap at 50 facts per session
    if (facts.filter(f => f.sessionId === msg.sessionId).length >= 50) break;
  }

  // final dedup + cap
  const bySession = new Map<string, Fact[]>();
  for (const fact of facts) {
    const arr = bySession.get(fact.sessionId) || [];
    arr.push(fact);
    bySession.set(fact.sessionId, arr);
  }

  const result: Fact[] = [];
  for (const [, sessionFacts] of bySession) {
    result.push(...sessionFacts.slice(0, 50));
  }

  return result;
}
