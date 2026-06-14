---
name: poketerm
description: Sync your terminal to phone/tablet — monitor Claude Code sessions from any browser.
---

# PokeTerm Skill

Starts a remote terminal server with Cloudflare Tunnel so you can access your Claude Code session from anywhere.

## When to invoke

`/poketerm` — user wants to see their terminal from phone or tablet.

## Configuration

Set this once (add to `~/.zshrc`):

```bash
export POKETERM_HOME="$HOME/个人ai服务器"
```

## Steps

### 1. Ensure tmux

```bash
brew list tmux &>/dev/null || brew install tmux
```

### 2. Detect or create tmux session

```bash
SAVED_PWD="$PWD"
if [ -n "$TMUX" ]; then
    TMUX_SESSION=$(tmux display-message -p '#S')
else
    if tmux has-session -t work 2>/dev/null; then
        TMUX_SESSION="work"
    else
        tmux new-session -d -s work -c "$SAVED_PWD"
        TMUX_SESSION="work"
    fi
fi
```

### 3. Start server

```bash
if lsof -ti:8765 >/dev/null 2>&1; then
    echo "PokeTerm already running on port 8765"
else
    cd "${POKETERM_HOME:-$HOME/PokeTermSkill}"
    TOKEN=$(head -c 12 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 12)
    TERM_TOKEN="$TOKEN" TERM_WORKSPACE="$SAVED_PWD" TERM_TMUX_SESSION="$TMUX_SESSION" \
      mvn spring-boot:run -q > /dev/null 2>&1 &
    sleep 8
fi
```

### 4. Start Cloudflare Tunnel

```bash
pkill -f "cloudflared.*localhost:8765" 2>/dev/null
cloudflared tunnel --url http://localhost:8765 > /tmp/poketerm-tunnel.log 2>&1 &
for i in $(seq 1 15); do
    TUNNEL_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/poketerm-tunnel.log | head -1)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
done
```

### 5. Output

```
PokeTerm ready — tmux session: <session>

  Same WiFi:  http://<local-ip>:8765
  Anywhere:   <tunnel_url>
  Token:      <token>

Open in any browser. Same Claude Code session on both devices.
```
