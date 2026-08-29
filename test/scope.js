// Per-project scoping regression test: membership state must be keyed by project
// directory, shared only via an explicit SESSION_MULTIPLAYER_DIR override
// (CLAUDE_TOGETHER_DIR is honored as a legacy alias).
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { projectKey, scopedDir, root } from '../src/scope.js'
import { Store } from '../src/store.js'

function tmpdir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `sm-scope-${label}-`))
}

const savedDir = process.env.SESSION_MULTIPLAYER_DIR
const savedLegacyDir = process.env.CLAUDE_TOGETHER_DIR
const savedProject = process.env.CLAUDE_PROJECT_DIR
delete process.env.SESSION_MULTIPLAYER_DIR
delete process.env.CLAUDE_TOGETHER_DIR

console.log('1. projectKey is stable, readable, and collision-safe…')
const a = tmpdir('a')
const b = tmpdir('b')
assert.equal(projectKey(a), projectKey(a), 'same dir -> same key')
assert.notEqual(projectKey(a), projectKey(b), 'different dirs -> different keys')
const sameName = path.join(tmpdir('parent'), path.basename(a))
fs.mkdirSync(sameName, { recursive: true })
assert.notEqual(projectKey(a), projectKey(sameName), 'same basename elsewhere -> different key')
assert.match(projectKey(a), /^[A-Za-z0-9._-]+-[0-9a-f]{12}$/, 'key is filesystem-safe')

console.log('2. scopedDir follows CLAUDE_PROJECT_DIR…')
process.env.CLAUDE_PROJECT_DIR = a
assert.equal(scopedDir(), path.join(root(), 'projects', projectKey(a)))
process.env.CLAUDE_PROJECT_DIR = b
assert.equal(scopedDir(), path.join(root(), 'projects', projectKey(b)))

console.log('3. SESSION_MULTIPLAYER_DIR overrides scoping with one exact directory…')
const override = tmpdir('override')
process.env.SESSION_MULTIPLAYER_DIR = override
assert.equal(scopedDir(), override)

console.log('   …and CLAUDE_TOGETHER_DIR still works as a legacy alias…')
delete process.env.SESSION_MULTIPLAYER_DIR
process.env.CLAUDE_TOGETHER_DIR = override
assert.equal(scopedDir(), override)
delete process.env.CLAUDE_TOGETHER_DIR
process.env.SESSION_MULTIPLAYER_DIR = override

console.log('4. a Store under the override keeps everything local, name included…')
const s = new Store()
assert.equal(s.dir, override)
assert.equal(s.identityFile, null, 'explicit dir -> no machine-global identity')
s.setName('scoped-test')
assert.equal(JSON.parse(fs.readFileSync(path.join(override, 'config.json'), 'utf8')).name, 'scoped-test')

console.log('5. rooms added in one store are invisible to another scope…')
const otherDir = tmpdir('other')
const s2 = new Store(otherDir)
s.addRoom('00aa', 'room-a', Buffer.alloc(32, 1))
assert.equal(s.rooms().length, 1)
assert.equal(s2.rooms().length, 0, 'other scope sees no rooms')

if (savedDir === undefined) delete process.env.SESSION_MULTIPLAYER_DIR
else process.env.SESSION_MULTIPLAYER_DIR = savedDir
if (savedLegacyDir === undefined) delete process.env.CLAUDE_TOGETHER_DIR
else process.env.CLAUDE_TOGETHER_DIR = savedLegacyDir
if (savedProject === undefined) delete process.env.CLAUDE_PROJECT_DIR
else process.env.CLAUDE_PROJECT_DIR = savedProject

console.log('\nAll scope tests passed.')
