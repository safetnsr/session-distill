import { Message } from '../core/extractor';
import { parseMarkdown } from './markdown';

export function isStdin(): boolean {
  return !process.stdin.isTTY;
}

const STRUCTURED_SECTIONS: Record<string, { pattern: string; confidence: number }> = {
  // explicit-instruction sections
  'rules': { pattern: 'explicit-instruction', confidence: 0.95 },
  'safety': { pattern: 'explicit-instruction', confidence: 0.95 },
  'efficiency': { pattern: 'explicit-instruction', confidence: 0.95 },
  'memory': { pattern: 'explicit-instruction', confidence: 0.95 },
  'constraints': { pattern: 'explicit-instruction', confidence: 0.95 },
  // stack-mention sections
  'stack': { pattern: 'stack-mention', confidence: 0.8 },
  'tech': { pattern: 'stack-mention', confidence: 0.8 },
  'dependencies': { pattern: 'stack-mention', confidence: 0.8 },
  // convention sections
  'workflow': { pattern: 'convention', confidence: 0.85 },
  'process': { pattern: 'convention', confidence: 0.85 },
  'how': { pattern: 'convention', confidence: 0.85 },
};

const MARKDOWN_SYNTAX_ONLY = /^(---|#{1,6}\s*$|```)/;

export function parseStructuredMarkdown(data: string): Message[] {
  const lines = data.split('\n');
  const messages: Message[] = [];
  let currentSection: string | null = null;
  let currentMeta: { pattern: string; confidence: number } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // skip blank lines and markdown-only syntax
    if (line.length === 0) continue;
    if (MARKDOWN_SYNTAX_ONLY.test(line)) continue;

    // check for ## header
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      const headerName = headerMatch[1].trim();
      const headerKey = headerName.toLowerCase();
      currentSection = headerName;
      currentMeta = STRUCTURED_SECTIONS[headerKey] || null;
      continue;
    }

    // skip other headers (# or ### etc.) that aren't content
    if (/^#{1,6}\s/.test(line) && !headerMatch) {
      // sub-headers within a section — treat as content if we have a section
      // but skip if it's just a standalone header
      if (!currentSection) continue;
    }

    const sessionId = currentSection ? `file:${currentSection}` : 'file:unknown';

    // Create message with metadata embedded
    // The extractor will handle pattern detection, but for structured mode
    // we force the content to match patterns by prefixing appropriately
    if (currentMeta) {
      // Strip leading list markers
      const cleanLine = line.replace(/^[-*]\s+/, '').trim();
      if (cleanLine.length === 0) continue;

      messages.push({
        role: 'human',
        content: cleanLine,
        sessionId,
        _structuredPattern: currentMeta.pattern,
        _structuredConfidence: currentMeta.confidence,
      } as any);
    } else {
      // No structured section — send as regular content for heuristic extraction
      const cleanLine = line.replace(/^[-*]\s+/, '').trim();
      if (cleanLine.length === 0) continue;

      messages.push({
        role: 'human',
        content: cleanLine,
        sessionId,
      });
    }
  }

  return messages;
}

export async function readStdin(structured?: boolean): Promise<Message[]> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (data.trim().length === 0) {
        resolve([]);
      } else if (structured) {
        resolve(parseStructuredMarkdown(data));
      } else {
        resolve(parseMarkdown(data, 'stdin'));
      }
    });
  });
}
