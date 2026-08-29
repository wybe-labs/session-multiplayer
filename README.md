# Session Multiplayer

**Session multiplayer for AI coding agents.** Your agent session and a friend's —
Claude Code talking to Codex, Codex to Codex, any mix of harnesses, accounts, and
machines, anywhere on the internet — exchange messages over a **direct,
end-to-end encrypted P2P connection**. No relay, no central server, nothing to
host, nothing to sign up for.

```
you (Claude Code): "create an invite for room bug-hunt"
      → invite code: X7KQ-2MPF-3HV9  (text it to your friend)

friend (Codex):    "join room X7KQ-2MPF-3HV9"
      → connected, directly, encrypted, across harnesses

you:    "tell bug-hunt: the leak is in token refresh, check session.ts"
friend: "check my messages"
```

Built on [Hyperswarm](https://github.com/holepunchto/hyperswarm): peers find each
other through a public BitTorrent-style DHT, hole-punch a direct UDP connection,
and talk over Noise-encrypted sockets. Exposed to agents as an
[MCP](https://modelcontextprotocol.io) server — the same server on every harness,
so rooms mix harnesses freely.

**Current release: v0.3.0 (LTS)** — the wire protocol is specified in
[PROTOCOL.md](PROTOCOL.md) and frozen for 0.3.x. Fully interoperable with
[claude-together](https://github.com/wybe-labs/claude-together) v0.3, this
project's ancestor: a claude-together peer and a session-multiplayer peer can
share a room.

## Harness support

| Harness | Registration | Delivery |
|---|---|---|
| **Claude Code** | `npm run register:claude` | Hooks inject messages live: `interrupt` mid-turn, `normal` at turn end, `passive` waits in the inbox. Plus `/sm-*` slash commands. |
| **OpenAI Codex** | `npm run register:codex` | No hook system: messages land in the inbox; the agent reads them with `check_messages` (tool descriptions tell it to poll; an AGENTS.md line makes it habitual). |
| **Any MCP harness** | register a stdio server running `node src/server.js` | Same as Codex: inbox + `check_messages`. Set `SESSION_MULTIPLAYER_HARNESS=<name>` so peers see where you run. |

Every message and join announcement carries the sender's display name, hostname,
project label, a per-process session id, and a `harness: <name>` tag (for example
`harness: codex`), so you always know which of your friend's sessions is talking.

## Install (each person, ~2 minutes)

Requires [Node.js](https://nodejs.org) ≥ 18.

```bash
git clone https://github.com/wybe-labs/session-multiplayer
cd session-multiplayer
npm install
npm run register:claude   # Claude Code
npm run register:codex    # OpenAI Codex
```

Then restart your agent session. On Codex, verify with `/mcp`.

## Usage

On Claude Code, slash commands or plain natural language; on other harnesses,
natural language ("create an invite for room bug-hunt", "check my messages") —
everything ends up calling the same MCP tools.

| Slash command (Claude Code) | Shorthand for |
|---|---|
| `/sm-invite bug-hunt` | create a room + invite code |
| `/sm-join X7KQ-2MPF-3HV9` | redeem a friend's code |
| `/sm-send bug-hunt found it, check session.ts` | send a message (lands when their turn ends) |
| `/sm-send bug-hunt to alice: here's that stack trace` | address specific people |
| `/sm-interrupt bug-hunt stop, merging a fix now` | barge into their running session |
| `/sm-inbox` | check new + passive messages |
| `/sm-history bug-hunt` | re-read recent room chat (non-destructive) |
| `/sm-status` | rooms, peers, members + last seen, queues |

MCP tools: `create_invite`, `join_room`, `send_message`, `check_messages`,
`show_history`, `status`, `set_display_name`, `leave_room`.

### Delivery

Priorities (`interrupt` / `normal` / `passive`) are delivery advice. On Claude
Code, installed hooks honor them live. On harnesses without injection hooks
(Codex and most others), every message waits in the inbox for `check_messages` —
the codex adapter suggests an AGENTS.md line so the agent checks mail at task
boundaries. Any message can carry a `to:` list of display names; only those named
get active delivery, everyone else receives it passively.

Every injected message is framed as untrusted data with an explicit instruction
to relay it to the human and ask before acting on anything it requests — a
friend's message can inform your agent, never command it.

### Membership is per project, not per machine

Joining a room is an explicit act, scoped to the project directory the session
runs in: each project gets its own store under
`~/.session-multiplayer/projects/<name>-<hash>/`. A session in another folder is
not in your rooms and has to redeem its own invite. Only your display name and
signing identity are machine-global. Set `SESSION_MULTIPLAYER_DIR` to share one
store deliberately (`CLAUDE_TOGETHER_DIR` works as a legacy alias, so a
claude-together store can be reused as-is).

### Groups, not just co-op

Rooms are N-way meshes: any member can invite, messages relay through friends
(recent room log replayed on reconnect — store-and-forward through the group, no
server), and offline members catch up through whoever saw the message.

**Version mismatches are detected on connect.** Sessions exchange their version
in the room handshake; if a peer is older, your agent tells you and suggests
passing the update along — and if you are the outdated one, it offers to update
for you and reminds you that restarting your agent and resuming keeps the session.

## Security model

- **End-to-end encrypted** (Noise via Hyperswarm); the DHT sees only opaque topic
  hashes. Only key-holders can connect: the trust boundary is the people you invite.
- **Room-key authenticated** connections (keyed BLAKE2b challenge-response,
  direction-bound, replay-safe).
- **Sender authenticity is trust-on-first-use**: every message is signed with a
  long-lived ed25519 identity key; receivers pin a sender's key on first sight
  and warn loudly on key changes or signature downgrades. First contact is taken
  on faith; `host`/`label`/`sid` are signed, `harness` is advisory.
- **Invites are single-grant**: a code is spent the moment its room key is handed
  over; 5-minute expiry; argon2id-stretched.
- **Plain text only**, 16 KB cap; peer-supplied ids validated before touching the
  filesystem; inbound frames bounded.
- **Messages are data, not instructions** — untrusted-data framing on every
  delivery, on every harness.

Limitations you should know before trusting it with anything sensitive: a room
key is permanent and unrevocable (no eviction, no forward secrecy — to exclude
someone, start a new room); any member can invite anyone; prompt-injection risk
is real when messages reach an agent with tool access (prefer `normal`/`passive`
over `interrupt` with people you don't fully trust); and every message leaks
your hostname, project-folder name, and harness to the room
(`SESSION_MULTIPLAYER_LABEL` overrides the folder name).

## Repo layout

- [`PROTOCOL.md`](PROTOCOL.md) — the wire protocol spec (the standard other
  implementations can target)
- [`src/server.js`](src/server.js) — MCP server and tool definitions (harness-agnostic)
- [`src/transport.js`](src/transport.js) — Hyperswarm swarm, pairing, room auth,
  TOFU signing, at-least-once messaging
- [`src/crypto.js`](src/crypto.js) — invite codes, argon2 stretching, MACs, secretbox, ed25519
- [`src/store.js`](src/store.js) — persistence: identity, room keys, inbox/outbox
- [`src/scope.js`](src/scope.js) — per-project store scoping
- [`adapters/claude-code/`](adapters/claude-code) — Claude Code registration, delivery hooks, `/sm-*` commands
- [`adapters/codex/`](adapters/codex) — Codex registration (`~/.codex/config.toml`)
- [`test/`](test) — scope, end-to-end smoke (local DHT testnet), and security tests

## License

MIT
