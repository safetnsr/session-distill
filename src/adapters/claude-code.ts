import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../core/extractor';

export function detectClaudeCode(): string | null {
  const claudeDir = path.join(process.env.HOME || '~', '.claude', 'projects');
  try {
    const stat = fs.statSync(claudeDir);
    if (stat.isDirectory()) return claudeDir;
  } catch {
    // not found
  }
  return null;
}

function findJsonlFiles(dir: string): { path: string; mtime: number }[] {
  const results: { path: string; mtime: number }[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findJsonlFiles(fullPath));
      } else if (entry.name.endsWith('.jsonl')) {
        const stat = fs.statSync(fullPath);
        results.push({ path: fullPath, mtime: stat.mtimeMs });
      }
    }
  } catch {
    // skip unreadable dirs
  }

  return results;
}

export function parseClaudeCode(dir: string, limit = 20): Message[] {
  const files = findJsonlFiles(dir)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const messages: Message[] = [];

  for (const file of files) {
    const sessionId = path.basename(file.path, '.jsonl');
    const content = fs.readFileSync(file.path, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);

        let role: string | undefined;
        let text: string | undefined;

        // format 1: { type: "message", message: { role, content } }
        if (obj.type === 'message' && obj.message) {
          role = obj.message.role;
          if (typeof obj.message.content === 'string') {
            text = obj.message.content;
          } else if (Array.isArray(obj.message.content)) {
            text = obj.message.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
          }
        }
        // format 2: { role, content }
        else if (obj.role && obj.content) {
          role = obj.role;
          if (typeof obj.content === 'string') {
            text = obj.content;
          } else if (Array.isArray(obj.content)) {
            text = obj.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
          }
        }

        if (role && text && (role === 'human' || role === 'user' || role === 'assistant')) {
          messages.push({
            role: role === 'user' ? 'human' : role as 'human' | 'assistant',
            content: text,
            sessionId,
            timestamp: obj.timestamp || undefined,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return messages;
}
