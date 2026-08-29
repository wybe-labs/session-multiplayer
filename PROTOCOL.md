# Session Multiplayer Protocol, v0.3

This document specifies the wire protocol spoken by `session-multiplayer` (and by
its ancestor `claude-together` v0.3, with which it is fully interoperable). Any
implementation that follows this spec can join the same rooms, regardless of
which agent harness (Claude Code, Codex, or any MCP client) or language it runs in.

Status: **frozen for 0.3.x (LTS)**. Additive optional fields are allowed; anything
that changes the meaning of existing fields, the crypto, or the canonical signing
form requires a major/minor version bump and explicit compatibility handling.

## 1. Transport

- Peer discovery and connections use [Hyperswarm](https://github.com/holepunchto/hyperswarm):
  a public BitTorrent-style DHT for rendezvous, UDP hole punching, and one
  Noise-encrypted socket per peer pair.
- Each connection carries newline-delimited JSON frames (NDJSON). One frame = one
  JSON object with a `t` field naming the message type.
- A receiver MUST cap the unparsed line buffer (reference: 256 KiB) and drop
  connections that exceed it. Unparseable lines are skipped.
- Connections are per-peer, not per-topic: one socket may carry several
  authenticated room/pairing contexts at once.

## 2. Keys, topics, and domain strings

All hashing is BLAKE2b-256 (`crypto_generichash`). `derive(key, context)` is
BLAKE2b-256 of the context string keyed by `key`.

- A **room key** is 32 random bytes, the room's permanent shared secret.
- **Room id**: first 8 bytes, hex-encoded, of `derive(roomKey, "claude-together-roomid")`.
- **DHT topic** for a context: `derive(key, "claude-together-topic-" + context)`
  where context is `"room"` for rooms and `"pairing"` for invites.

> The `claude-together-*` domain strings are FROZEN historical constants carried
> over from this protocol's origin project. Implementations MUST use them
> verbatim; renaming them splits the network.

## 3. Invite pairing

An invite code is 12 characters of Crockford base32 (no I, L, O, U), displayed as
`XXXX-XXXX-XXXX`, ~60 bits of entropy. Normalization: uppercase, strip
non-alphanumerics, map I/L to 1, O to 0, U to V.

- **Code key**: argon2id (`crypto_pwhash`, opslimit 3, memlimit 64 MiB) of the
  normalized code, salted with the first 16 bytes of
  BLAKE2b-256("claude-together-pairing-salt-v1") (fixed salt; codes are random
  and single-use).
- Both sides join the pairing topic for the code key and run the auth handshake
  (section 4) with the code key as a `pair` candidate.
- The inviter then sends a **grant**: the room key and room name, JSON-encoded,
  sealed with XSalsa20-Poly1305 (`crypto_secretbox`, random 24-byte nonce
  prepended) under the code key.
- An invite is **spent when the first grant is sent** — implementations MUST NOT
  grant the same code twice, and SHOULD expire unredeemed invites after 5 minutes.
- The joiner decrypts, stores the room key, replies `grant-ack`, and both sides
  re-prove contexts so the existing socket can carry the new room.

## 4. Authentication handshake

Trust comes only from key knowledge, never from connection identity (the
Hyperswarm keypair SHOULD be ephemeral per process).

1. On connect, each side sends `{"t":"auth1","nonce":<base64, 24 random bytes>}`.
2. Each side answers with `{"t":"auth2","proofs":[{id, kind, mac}]}` — one proof
   per held key: `kind` is `"room"` (id = room id) or `"pair"` (id = pairing
   topic hex); `mac` is base64 of BLAKE2b-256 keyed by `derive(key, "auth")`
   over `peerNonce || ownNonce` (direction-bound, replay-safe).
3. A peer that proves a room key is granted that room's context on this socket.
   Proofs are re-sent whenever the local key set changes. Verify with
   constant-time comparison. Drop connections that prove nothing within a
   timeout (reference: 30 s).

On proving a room context, a peer SHOULD immediately replay its unacked outbox
and recent room log (section 7) to the newly proven peer.

## 5. Room messages

```json
{"t":"msg", "id":"<hex, 1-32 chars>", "roomId":"<hex>", "from":"<name ≤64>",
 "text":"<≤16384 chars>", "ts":<unix ms>, "priority":"interrupt|normal|passive",
 "kind":"chat|presence", "host":"<≤64>", "label":"<≤64>", "sid":"<hex ≤16>",
 "harness":"<≤32>", "to":["<name>", ...], "pk":"<64 hex>", "sig":"<128 hex>"}
```

- `id` is sender-chosen, random, hex, at most 32 chars. Receivers MUST validate
  the shape before using it anywhere near a filesystem, MUST ack every valid id
  (`{"t":"ack","id":...}`), and MUST deduplicate by id.
- `text` is plain text, hard-capped at 16 KiB. No files, no commands.
- `kind: "presence"` marks join announcements and status notes; everything else
  is `"chat"`.
- `priority` is delivery advice for the receiving harness: `interrupt` (inject
  mid-turn where the harness supports it), `normal` (deliver at turn end),
  `passive` (inbox only). Harnesses without injection hooks treat everything as
  inbox mail. Receivers SHOULD demote stale interrupts (older than ~5 minutes)
  to normal, and SHOULD demote messages addressed via `to` to passive for
  everyone not named.
- `to` (optional): up to 32 display names that should receive the message at its
  active priority. Advisory, not access control.
- `host`, `label`, `sid`, `harness` identify the sender's machine, project,
  process, and agent harness (e.g. `claude-code`, `codex`). All are self-asserted;
  `harness` is additionally outside the signed form (section 6).

## 6. Sender authenticity (TOFU)

Each identity holds a long-lived ed25519 keypair.

- **Canonical signing form** (frozen for 0.3): the JSON array
  `[id, roomId, from, text, ts, priority, kind, host||"", label||"", sid||"", to.join("\n")||""]`
  serialized with `JSON.stringify`, signed with `crypto_sign_detached`.
- Messages carry `pk` (32-byte public key, hex) and `sig` (64-byte detached
  signature, hex). Both travel with the message through relays and log replays,
  so late receivers can verify the original sender.
- Receivers MUST drop messages whose signature fails to verify, SHOULD pin the
  first verified key seen for a display name (per room), and MUST warn the user
  when a pinned sender's key changes or a pinned sender's message arrives
  unsigned. Unsigned messages from unknown senders are accepted for backward
  compatibility.
- `harness` is NOT part of the canonical form (it postdates the freeze); treat
  it as unauthenticated decoration.

## 7. Reliability

- **Outbox**: sent messages persist until at least one peer acks the id, and are
  replayed to every newly proven room peer.
- **Room log**: each member keeps the recent room history (reference: 200
  messages / 7 days) and replays it on reconnect — store-and-forward through
  friends, no server. Dedup by id makes this idempotent.
- **Forwarding**: on receiving a novel message, forward it to all other live
  peers proven for that room (heals partial meshes; dedup stops loops).

## 8. Hello and version handshake

After proving a room, each side sends
`{"t":"hello", "roomId", "name", "host", "label", "sid", "harness", "v":"<semver>"}`.

`v` is the implementation's protocol/package version. On mismatch, an
implementation SHOULD surface a local notice to its user (never a wire message):
suggest the older side update. A missing `v` means a pre-0.3 peer.

## 9. Privacy properties

The DHT sees only opaque topic hashes. Only key-holders can connect and complete
the handshake, so the trust boundary is the invited membership. A room key is a
permanent, unrevocable shared secret: there is no member eviction and no forward
secrecy. Every message discloses hostname, project label, session id, and
harness to the room.
