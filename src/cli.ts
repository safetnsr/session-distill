#!/usr/bin/env node

import { autoDetect, loadMessages } from './adapters';
import { extractFacts } from './core/extractor';
import { clusterFacts } from './core/cluster';
import { rankClusters } from './core/ranker';
import { renderCLAUDEMD } from './core/renderer';
import * as fs from 'fs';

const VERSION = '0.2.0';
const HELP = `
session-distill — distill recurring context from AI agent sessions into CLAUDE.md

usage:
  npx @safetnsr/session-distill [options]

options:
  --adapter <name>    force adapter: claude-code | aider | markdown | stdin
  --project <path>    path to sessions directory or file
  --top <n>           show top N patterns without generating CLAUDE.md
  --merge             merge with existing CLAUDE.md instead of replacing
  --diff              show what would change without writing
  --json              machine-readable output
  --all               scan all sessions (default: 20 most recent)
  --out <file>        write to file instead of stdout (default: stdout)
  --version, -v       show version
  --help, -h          show help

examples:
  npx @safetnsr/session-distill                    # auto-detect, output to stdout
  npx @safetnsr/session-distill --out CLAUDE.md    # write directly to CLAUDE.md
  npx @safetnsr/session-distill --top 10           # show top 10 patterns
  npx @safetnsr/session-distill --diff             # preview changes
  cat chat.md | npx @safetnsr/session-distill      # pipe any chatlog
  cat AGENTS.md SOUL.md | npx @safetnsr/session-distill --from-files  # file-based fallback
`;

interface Args {
  adapter?: string;
  project?: string;
  top?: number;
  merge: boolean;
  diff: boolean;
  json: boolean;
  all: boolean;
  out?: string;
  fromFiles: boolean;
  version: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    merge: false,
    diff: false,
    json: false,
    all: false,
    fromFiles: false,
    version: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--adapter':
        args.adapter = argv[++i];
        break;
      case '--project':
        args.project = argv[++i];
        break;
      case '--top':
        args.top = parseInt(argv[++i], 10);
        break;
      case '--merge':
        args.merge = true;
        break;
      case '--diff':
        args.diff = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--from-files':
        args.fromFiles = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }

  let adapter: string;
  let projectPath: string;

  if (args.fromFiles || (!process.stdin.isTTY && !args.adapter)) {
    adapter = 'stdin';
    projectPath = 'stdin';
  } else if (args.adapter && args.project) {
    adapter = args.adapter;
    projectPath = args.project;
  } else {
    const detected = await autoDetect(process.cwd());
    if (!detected) {
      if (args.json) {
        console.log(JSON.stringify({
          sessions_analyzed: 0,
          no_sessions: true,
          patterns: [],
          filtered_patterns: [],
          claude_md: '',
        }, null, 2));
        return;
      }
      console.error('no agent sessions found. try: cat AGENTS.md SOUL.md | npx @safetnsr/session-distill --from-files');
      return;
    }
    adapter = args.adapter || detected.adapter;
    projectPath = args.project || detected.path;
  }

  const messages = await loadMessages(adapter, projectPath, args.all);

  if (messages.length === 0) {
    if (args.json) {
      console.log(JSON.stringify({
        sessions_analyzed: 0,
        no_sessions: true,
        patterns: [],
        filtered_patterns: [],
        claude_md: '',
      }, null, 2));
      return;
    }
    console.error('no messages found in sessions.');
    return;
  }

  const sessionIds = new Set(messages.map(m => m.sessionId));
  const totalSessions = sessionIds.size;

  const facts = extractFacts(messages);
  const clusters = clusterFacts(facts);
  const ranked = rankClusters(clusters, totalSessions);

  if (args.json) {
    const claudeMd = renderCLAUDEMD(ranked, totalSessions);
    const filtered = ranked.filter(r => r.confidence >= 0.6 && r.sessionCount >= 2);
    const topPatterns = args.top ? ranked.slice(0, args.top) : ranked;
    console.log(JSON.stringify({
      sessions_analyzed: totalSessions,
      no_sessions: totalSessions === 0,
      patterns: topPatterns.map(r => ({
        text: r.text,
        sessionCount: r.sessionCount,
        totalSessions: r.totalSessions,
        confidence: r.confidence,
        pattern: r.pattern,
      })),
      filtered_patterns: filtered.map(r => ({
        text: r.text,
        sessionCount: r.sessionCount,
        totalSessions: r.totalSessions,
        confidence: r.confidence,
        pattern: r.pattern,
      })),
      claude_md: claudeMd,
    }, null, 2));
    return;
  }

  if (args.top) {
    const topFacts = ranked.slice(0, args.top);
    console.log(`top ${topFacts.length} recurring patterns (${totalSessions} sessions analyzed):\n`);
    for (let i = 0; i < topFacts.length; i++) {
      const f = topFacts[i];
      console.log(`  ${i + 1}. ${f.text} (${f.sessionCount}/${totalSessions} sessions, ${f.pattern})`);
    }
    return;
  }

  const claudeMd = renderCLAUDEMD(ranked, totalSessions);

  if (args.diff) {
    const outPath = args.out || 'CLAUDE.md';
    let existing = '';
    try {
      existing = fs.readFileSync(outPath, 'utf-8');
    } catch {
      // no existing file
    }
    if (existing === claudeMd) {
      console.log('no changes.');
    } else {
      console.log('--- would generate:\n');
      console.log(claudeMd);
    }
    return;
  }

  if (args.out) {
    if (args.merge) {
      let existing = '';
      try {
        existing = fs.readFileSync(args.out, 'utf-8');
      } catch {
        // no existing file
      }
      fs.writeFileSync(args.out, existing + '\n' + claudeMd);
      console.log(`merged into ${args.out}`);
    } else {
      fs.writeFileSync(args.out, claudeMd);
      console.log(`written to ${args.out}`);
    }
    return;
  }

  // default: stdout
  console.log(claudeMd);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(0); // always exit 0
});
