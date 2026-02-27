import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../core/extractor';

export function detectAider(cwd: string): string | null {
  let dir = cwd;
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, '.aider.chat.history.md');
    try {
      fs.statSync(candidate);
      return candidate;
    } catch {
      // not found
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function parseAider(filePath: string): Message[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const messages: Message[] = [];
  const sessionId = path.basename(filePath, '.md');

  const blocks = content.split(/^####\s+/m).filter(b => b.trim().length > 0);

  for (const block of blocks) {
    const firstNewline = block.indexOf('\n');
    if (firstNewline === -1) continue;

    const header = block.substring(0, firstNewline).trim().toLowerCase();
    const body = block.substring(firstNewline + 1).trim();

    if (!body) continue;

    let role: 'human' | 'assistant';
    if (header === 'human' || header === 'user') {
      role = 'human';
    } else if (header === 'aider' || header === 'assistant') {
      role = 'assistant';
    } else {
      continue;
    }

    messages.push({
      role,
      content: body,
      sessionId,
    });
  }

  return messages;
}
