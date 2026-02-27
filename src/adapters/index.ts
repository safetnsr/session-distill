import { Message } from '../core/extractor';
import { detectClaudeCode, parseClaudeCode } from './claude-code';
import { detectAider, parseAider } from './aider';
import { parseMarkdown } from './markdown';
import { isStdin, readStdin } from './stdin';
import * as fs from 'fs';

export { detectClaudeCode, parseClaudeCode } from './claude-code';
export { detectAider, parseAider } from './aider';
export { parseMarkdown } from './markdown';
export { isStdin, readStdin } from './stdin';

export interface DetectResult {
  adapter: string;
  path: string;
}

export async function autoDetect(cwd: string): Promise<DetectResult | null> {
  // check claude code
  const claudePath = detectClaudeCode();
  if (claudePath) {
    return { adapter: 'claude-code', path: claudePath };
  }

  // check aider
  const aiderPath = detectAider(cwd);
  if (aiderPath) {
    return { adapter: 'aider', path: aiderPath };
  }

  // check stdin
  if (isStdin()) {
    return { adapter: 'stdin', path: 'stdin' };
  }

  return null;
}

export async function loadMessages(
  adapter: string,
  projectPath: string,
  all = false,
  structured = false
): Promise<Message[]> {
  switch (adapter) {
    case 'claude-code':
      return parseClaudeCode(projectPath, all ? 1000 : 20);
    case 'aider':
      return parseAider(projectPath);
    case 'markdown':
      return parseMarkdown(fs.readFileSync(projectPath, 'utf-8'), projectPath);
    case 'stdin':
      return readStdin(structured);
    default:
      throw new Error(`unknown adapter: ${adapter}`);
  }
}
