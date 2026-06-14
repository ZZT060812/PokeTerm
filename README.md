# PokeTerm

> **A Claude Code skill** — type `/poketerm` in any Claude Code session to share your terminal to phone or tablet. WebSocket + tmux, zero client install.

## What it does

You're running Claude Code on your main machine. You step out — `/poketerm` gives you a URL. Open it on your phone and see the exact same terminal, with a file manager on the side. Both devices share the same tmux session, so input and output are fully synchronized.

## Install

Drop the skill file into your project:

```bash
cp .claude/skills/poketerm.md ~/your-project/.claude/skills/
```

Or copy it to `~/.claude/skills/` for global access across all projects.

Requires Java 21+, Maven 3.9+, tmux.

## Use

```
> /poketerm

  Remote terminal ready — tmux session: work
  Local:   http://localhost:8765
  Network: http://192.168.1.5:8765
  Token:   a1b2c3d4e5f6

  Open in any browser. Enter the token when prompted.
```

The skill auto-detects your tmux session. If you're not in one, it creates a `work` session for you. Your Claude Code conversation is not interrupted.

You get:
- **A real terminal** — same PTY, same shell, same Claude Code screen. Type from either device.
- **A file manager** — browse, edit, create, delete files from your phone.
- **Auto-reconnect** — network drop? Picks up where you left off, replays missed output.

## Remote access

Same WiFi — open the `Network` URL. Outside the house:

```bash
cloudflared tunnel --url http://localhost:8765
```

One command, free, no registration. Opens a public HTTPS URL.

## How it works

```
Claude Code session          Phone / Tablet
┌──────────────┐            ┌──────────────┐
│ /poketerm    │──spawns──►│ Java server   │◄──WebSocket──► Browser
│ tmux session │            │ + pty4j       │   terminal I/O
│   zsh        │◄──attach──│ tmux attach   │   file ops
│   └─ claude  │            └──────────────┘
└──────────────┘
```

The server uses `tmux attach` to join your session. Everything you see in your terminal is streamed to the browser over WebSocket. xterm.js renders it with full ANSI color support. File operations go over the same WebSocket connection.

## Tech

| Layer | Choice |
|-------|--------|
| Skill | Claude Code skill (`.md`) |
| Server | Java 21 + Spring Boot 3.3 |
| PTY | pty4j (JetBrains) |
| Screen share | tmux |
| Frontend | xterm.js + vanilla JS |
| Protocol | JSON over WebSocket |
| Auth | Token (constant-time compare) |

## Security

- Token required for WebSocket connection
- File ops sandboxed to workspace root (symlink-aware)
- Sensitive files (`.env`, `.git/config`) flagged on read
- >1MB files show truncated preview

## License

MIT
