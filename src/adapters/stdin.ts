import { Message } from '../core/extractor';
import { parseMarkdown } from './markdown';

export function isStdin(): boolean {
  return !process.stdin.isTTY;
}

export async function readStdin(): Promise<Message[]> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (data.trim().length === 0) {
        resolve([]);
      } else {
        resolve(parseMarkdown(data, 'stdin'));
      }
    });
  });
}
