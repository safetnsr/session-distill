import { Message } from '../core/extractor';

export function parseMarkdown(content: string, sessionId = 'markdown'): Message[] {
  const messages: Message[] = [];

  // try **User:** / **Assistant:** format
  const boldPattern = /\*\*(User|Human|Assistant):\*\*/gi;
  // try ### Human / ### Assistant format
  const headerPattern = /^###\s+(Human|User|Assistant)\s*$/gim;

  let pattern: RegExp;
  let matches: RegExpMatchArray[];

  // detect which format
  const boldMatches = [...content.matchAll(boldPattern)];
  const headerMatches = [...content.matchAll(headerPattern)];

  if (boldMatches.length >= 2) {
    pattern = boldPattern;
    matches = boldMatches;
  } else if (headerMatches.length >= 2) {
    pattern = headerPattern;
    matches = headerMatches;
  } else {
    // fallback: treat entire content as one human message
    return [{
      role: 'human',
      content: content.trim(),
      sessionId,
    }];
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = match[1].toLowerCase();
    const startIdx = match.index! + match[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const body = content.substring(startIdx, endIdx).trim();

    if (!body) continue;

    const role: 'human' | 'assistant' =
      label === 'assistant' ? 'assistant' : 'human';

    messages.push({
      role,
      content: body,
      sessionId,
    });
  }

  return messages;
}
