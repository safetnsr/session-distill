# session-distill

distill recurring context from AI agent sessions into CLAUDE.md.

**stop re-explaining yourself every session.**

## install

```bash
npx @safetnsr/session-distill
```

zero dependencies beyond chalk. no config. no network calls.

## usage

```bash
# auto-detect agent sessions, output to stdout
npx @safetnsr/session-distill

# write directly to CLAUDE.md
npx @safetnsr/session-distill --out CLAUDE.md

# preview top 10 recurring patterns
npx @safetnsr/session-distill --top 10

# show what would change without writing
npx @safetnsr/session-distill --diff

# pipe any chatlog
cat chat.md | npx @safetnsr/session-distill

# machine-readable output
npx @safetnsr/session-distill --json
```

## supported agents

- **claude code** — reads `~/.claude/projects/` JSONL files automatically
- **aider** — reads `.aider.chat.history.md` from cwd or parent dirs
- **any chatlog** — pipe markdown-formatted chatlogs via stdin

## how it works

session-distill runs a 4-step pipeline, 100% local:

1. **extract** — heuristic pattern matching finds facts in your messages: explicit instructions ("always use typescript"), stack mentions, conventions ("we use X"), and corrections ("no, we use npm not pip")
2. **cluster** — Jaccard similarity groups related facts across sessions (threshold > 0.6)
3. **rank** — frequency × recency scoring surfaces the most important recurring patterns
4. **render** — generates a structured CLAUDE.md with sections: stack, workflow, preferences, context

every line includes `(seen in X/Y sessions)` so you can verify what matters.

## options

```
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
```

## privacy

100% local. zero network calls. your sessions never leave your machine.

session-distill reads files from your local filesystem, processes them in memory, and outputs to stdout or a local file. nothing is sent anywhere.

## license

MIT
