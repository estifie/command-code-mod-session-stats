# command-code-mod-session-stats

A [Command Code](https://commandcode.ai) mod that keeps a session's vitals visible in the
footer: how full the context window is, how well the prompt cache is hitting, and how much
the chat has cost — sub-agents included.

```text
# a regular session
ctx 27.2% (272k/1M) · cache 99.8% · $0.524

# with sub-agents running
ctx 27.2% (272k/1M) · cache 99.8% · $0.565 · sub 42k
```

`/spend` prints the full breakdown on demand:

```text
spend $0.565 · in 272k (cache 271k) · out 338 · cache hit 99.8% · ctx 272k/1M (27.2%) · sub-agents 42k tokens (~$0.041 est.)
```

## Features

- **Context pressure** — the last request's usage against the model's window, from the last
  committed turn (or the in-flight request). Green under 50%, yellow to 80%, red beyond.
- **Cache-hit rate** — cached input as a share of the request's input tokens.
- **Session spend** — read from the session's own transcript, so it is the same number
  Command Code computes, not a re-derived guess from a hardcoded price table.
- **Sub-agent usage** — their tokens are never persisted anywhere, so they are folded in from
  the event stream and billed at the session's blended rate.
- **Resume-friendly** — an old chat shows its history as soon as it is opened.
- **Out of the way** — right-aligned to the terminal edge by default, and one line only.
- **`/spend`** — the full breakdown on demand, and a `compact` mode when space is tight.

The mod reads local session files only. It makes no network requests and sends nothing
anywhere.

## Install

From a checkout:

```bash
cmd mods add ./command-code-mod-session-stats
```

From Git:

```bash
cmd mods add estifie/command-code-mod-session-stats
```

Or drop the directory into a mods folder by hand:

| Scope | Path | Notes |
| --- | --- | --- |
| User | `~/.commandcode/mods/` | every project |
| Project | `<project>/.commandcode/mods/` | trust-gated |

Mods load once per process — run `/reload`, or start a new session, to pick up changes.

## Usage

Nothing to configure; the footer segment appears as soon as the session has anything to
report and refreshes through the run.

### Footer anatomy

| Segment | Meaning |
| --- | --- |
| `ctx 27.2% (272k/1M)` | Context window used / limit. The pair is hidden in compact mode. |
| `cache 99.8%` | Cache-hit rate of the most recent request. |
| `$0.524` | Total spend for this chat so far. `cost –` when the model has no pricing. |
| `sub 42k` | Sub-agent tokens. Shown only once a sub-agent has run. |

### Options

| Option | Effect |
| --- | --- |
| `--mod-option compact=true` | Drop the `(272k/1M)` pair and the `sub` count, leaving `ctx 27.2% · cache 99.8% · $0.524`. |
| `--mod-option align=left` | Stop padding the footer to the right edge; leave it left-aligned. |

### Commands

| Command | Effect |
| --- | --- |
| `/spend` | Print tokens in/out, cached input, cache-hit rate, context and cost. |

## How it works

The mod merges two sources.

**1. The session transcript.** Command Code writes an append-only log per session at
`~/.commandcode/projects/<project>/<session>.jsonl`. The mod reads it **incrementally** —
only the bytes appended since the last read — and folds every usage-bearing entry into
session totals. Because the CLI prices each entry as it commits, this yields exact
`costUsd` totals for the whole chat (abandoned branches included, which is what the chat
actually cost), plus the last committed request's usage and model. That is what lets a
resumed chat show its history immediately.

**2. The live event stream.**

| Event | Used for |
| --- | --- |
| `run_start` | The session id (and to start a fresh run). |
| `model_request_end` | The in-flight request's usage and model — updates before the transcript commits. |
| `subagent_stop` | Sub-agent tokens. |
| `turn_end` / `run_end` | Fold newly committed transcript bytes in. |

Total spend is `sum(costUsd)` from the transcript, plus sub-agent tokens times the session's
blended dollars-per-token.

### Session lookup on resume

A mod is never handed the id of the session it is bound to. The mod learns it from
`run_start`, or from `--resume` / `--session` in `argv`. When a session is resumed and has
not run yet, it appends one inert `custom` entry through the public session API and finds the
transcript that received it. That entry is mod-private: it is never sent to the model and
never rendered.

## Accuracy

| Number | Source | Exact? |
| --- | --- | --- |
| Context usage | Last request's usage vs. the model window | Usage is exact; the window comes from a catalog snapshot |
| Cache-hit rate | Last request's `cacheReadTokens / inputTokens` | Yes |
| Session spend | `costUsd` summed from the transcript | Yes |
| Sub-agent spend | `tokensUsed ×` session blended rate | Estimated — labelled `est.` in `/spend` |

## Limitations

- **The footer is a single bottom row.** `cmd.ui.setStatus` is the only UI surface a mod can
  render into today, and the host draws it under the input panel with no alignment option.
  Right alignment is therefore emulated by left-padding the text to the terminal width
  (`align=right`, the default), re-padded on resize. The host sanitises a segment with
  `replace(/ +/g, ' ').trim()`, so the padding is made of U+2800 BRAILLE PATTERN BLANK — an
  invisible, one-column glyph — instead of spaces, which would be collapsed away. On a
  terminal too narrow for the line the padding drops and the text truncates; use `compact`
  when space is tight. There is no top-right corner placement or in-place widget (Command
  Code's widget API is documented as not wired yet).
- **Pricing is Command Code's.** If the CLI could not price a model, entries carry no
  `costUsd` and the footer shows `cost –` instead of a fabricated number.
- **Context windows are a snapshot** of the model catalog in `src/context-windows.ts`. An
  unknown model falls back to 200k, so the percentage is approximate but never crashes.
- **No session file** (`--no-session`) means no cost history; live context and cache still
  work.

## Development

Requires Node 22.6+ for native TypeScript execution.

```bash
npm test        # node --test — 33 tests
```

The source is plain TypeScript with no build step: Command Code loads `index.ts` through
jiti, and the tests exercise the pure modules directly through Node's type stripping.

```
index.ts              thin ModApi entry point
src/mod.ts            wiring, rendering, session resolution
src/session-log.ts    incremental transcript reader
src/session-finder.ts locating the active transcript on disk
src/context-windows.ts model → context window
src/format.ts         number and tone helpers
src/ansi.ts           colors
src/align.ts          right-alignment padding
src/argv.ts           session id from process args
test/                 unit + integration tests (mock ModApi)
```

## License

[MIT](LICENSE)
