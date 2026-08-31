// Cross-implementation interop test: pairs this session-multiplayer checkout
// with a claude-together checkout (the protocol's origin implementation) on a
// local DHT testnet and verifies signed messages flow both ways.
//
// Needs a claude-together checkout with node_modules installed; point
// CLAUDE_TOGETHER_PATH at it (default: ../claude-together, then ../ClaudeTogether).
// Skips cleanly when none is found. Run: npm run test:interop
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import createTestnet from 'hyperdht/testnet.js'
import { Store } from '../src/store.js'
import { Together } from '../src/transport.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const candidates = [
  process.env.CLAUDE_TOGETHER_PATH,
  path.resolve(here, '..', '..', 'claude-together'),
  path.resolve(here, '..', '..', 'ClaudeTogether')
].filter(Boolean)
const ctRoot = candidates.find(p => fs.existsSync(path.join(p, 'src', 'transport.js')))
if (!ctRoot) {
  console.log('No claude-together checkout found (set CLAUDE_TOGETHER_PATH) — skipping interop test.')
  process.exit(0)
}
console.log(`Using claude-together at ${ctRoot}`)

const ct = {
  Store: (await import(pathToFileURL(path.join(ctRoot, 'src/store.js')).href)).Store,
  Together: (await import(pathToFileURL(path.join(ctRoot, 'src/transport.js')).href)).Together
}

function tmpdir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `sm-interop-${label}-`))
}

function waitFor (emitter, event, pred = () => true, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    const onEvent = v => {
      if (!pred(v)) return
      clearTimeout(t)
      emitter.off(event, onEvent)
      resolve(v)
    }
    emitter.on(event, onEvent)
  })
}

process.env.SESSION_MULTIPLAYER_HARNESS = 'interop-test'

const testnet = await createTestnet(3)
const bootstrap = testnet.bootstrap

const alice = new ct.Together({ store: new ct.Store(tmpdir('ct')), bootstrap })
const bob = new Together({ store: new Store(tmpdir('sm')), bootstrap })
alice.store.setName('alice-ct')
bob.store.setName('bob-sm')
await alice.start()
await bob.start()

console.log('1. claude-together invites, session-multiplayer joins…')
const inv = alice.createInvite('mixed-room')
const joined = await bob.joinWithCode(inv.code)
assert.equal(joined.roomName, 'mixed-room')

console.log('2. session-multiplayer -> claude-together, signature verifies…')
const gotByAlice = waitFor(alice, 'message', m => m.kind === 'chat')
bob.sendMessage('mixed-room', 'hello from the other side')
const m1 = await gotByAlice
assert.equal(m1.from, 'bob-sm')
assert.equal(m1.auth, 'verified', 'harness field must not break the frozen signing form')

console.log('3. claude-together -> session-multiplayer, signature verifies…')
const gotByBob = waitFor(bob, 'message', m => m.kind === 'chat')
alice.sendMessage('mixed-room', 'right back at you')
const m2 = await gotByBob
assert.equal(m2.from, 'alice-ct')
assert.equal(m2.auth, 'verified')
// claude-together 0.3.1+ sends the harness field too (same env in this shared
// process). The field stays optional on the wire, so pre-0.3.1 peers that omit
// it are still accepted — that path is covered by the optional parsing itself.
assert.equal(m2.harness, 'interop-test', 'harness field round-trips from a claude-together peer')

await alice.stop()
await bob.stop()
await testnet.destroy()
console.log('\nInterop test passed: claude-together and session-multiplayer share rooms.')
process.exit(0)
