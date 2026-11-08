// Codex registration and delivery. HOME and CODEX_HOME are temp dirs for the whole
// file: nothing here may read or rewrite the real ~/.codex/config.toml or a real
// session-multiplayer store. The trust steps need the `codex` CLI; without it they
// are skipped (and say so), the rest still runs.
import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const fakeHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sm-home-')))
const codexHome = path.join(fakeHome, '.codex')
fs.mkdirSync(codexHome)
process.env.HOME = fakeHome
process.env.USERPROFILE = fakeHome
process.env.CODEX_HOME = codexHome
for (const k of ['CLAUDE_PROJECT_DIR', 'SESSION_MULTIPLAYER_DIR', 'CLAUDE_TOGETHER_DIR']) delete process.env[k]
assert.equal(os.homedir(), fakeHome, 'test must not touch the real home directory')

const { installCodex, installCodexHooks, mcpServerConfig, codexHookCommand, HOOK_SCRIPT, SERVER } = await import('../adapters/codex/install.js')
const { withAppServer } = await import('../adapters/codex/app-server.js')
const { projectKey } = await import('../src/scope.js')

const hooksFile = path.join(codexHome, 'hooks.json')
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'))

console.log('1. Codex hooks merge with foreign hooks and stay single…')
fs.writeFileSync(hooksFile, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo someone-elses-hook' }] }] } }))
installCodexHooks()
installCodexHooks()
const h = readJson(hooksFile)
assert.equal(h.hooks.Stop.length, 2, 'foreign Stop hook kept, ours added once')
assert.match(h.hooks.Stop[0].hooks[0].command, /someone-elses-hook/)
assert.equal(h.hooks.Stop[1].hooks[0].command, codexHookCommand('stop'))
assert.equal(h.hooks.PostToolUse.length, 1)
assert.equal(h.hooks.PostToolUse[0].matcher, '.*', 'Codex matchers are regexes')
assert.equal(h.hooks.UserPromptSubmit.length, 1)

console.log('1b. A group shared with someone else\'s hook keeps theirs; unsafe paths are refused…')
const mixed = readJson(hooksFile)
mixed.hooks.Stop[1].hooks.push({ type: 'command', command: 'echo guard' })
mixed.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo session-multiplayer/hook.js stop codex-like-but-not-ours' }] })
mixed.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo session-multiplayer/hook.js stop codex' }] })
// An older registration from another node/checkout path is ours and gets replaced.
mixed.hooks.Stop.push({ hooks: [{ type: 'command', command: '"/old/node" "/old/session-multiplayer/adapters/claude-code/hook.js" stop codex' }] })
fs.writeFileSync(hooksFile, JSON.stringify(mixed))
installCodexHooks()
const m2 = readJson(hooksFile).hooks.Stop.flatMap(g => g.hooks.map(x => x.command))
assert.ok(m2.includes('echo guard'), 'sibling hook in a shared group survives')
assert.ok(m2.some(c => c.includes('codex-like-but-not-ours')), 'only exact adapter hooks are removed')
assert.ok(m2.includes('echo session-multiplayer/hook.js stop codex'), 'a command that merely ends like ours is kept')
assert.ok(!m2.some(c => c.includes('/old/node')), 'a stale registration of ours is replaced')
assert.equal(m2.filter(c => c === codexHookCommand('stop')).length, 1, 'ours still once')
for (const p of ['/x/$(touch pwned)/hook.js', '/x/`id`/hook.js', '/x/%PATH%/hook.js', '/x/a"b/hook.js']) {
  assert.throws(() => codexHookCommand('stop', { hookScript: p }), /safe hook command/, p)
}

console.log('2. The MCP server is labelled as Codex and sees the store overrides…')
const mcp = mcpServerConfig()
assert.equal(mcp.env.SESSION_MULTIPLAYER_HARNESS, 'codex')
assert.ok(mcp.env_vars.includes('SESSION_MULTIPLAYER_DIR'))

console.log('3. Under Codex the hook drains the session project\'s inbox, whatever the environment says…')
const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sm-codex-proj-')))
const inbox = path.join(fakeHome, '.session-multiplayer', 'projects', projectKey(project), 'inbox')
fs.mkdirSync(inbox, { recursive: true })
const put = (name, m) => fs.writeFileSync(path.join(inbox, name), JSON.stringify({ roomName: 'bug-hunt', from: 'alice', ts: 1, harness: 'claude-code', ...m }))
put('1.json', { text: 'check session.ts', priority: 'normal' })
// As Codex runs it: from elsewhere, with an unrelated CLAUDE_PROJECT_DIR inherited
// from wherever Codex was launched. The cwd Codex reports must win.
const env = { ...process.env, CLAUDE_PROJECT_DIR: path.join(fakeHome, 'some-other-project') }
const runHook = (mode, stdin) => spawnSync(process.execPath, [HOOK_SCRIPT, mode, 'codex'], { cwd: fakeHome, env, input: JSON.stringify(stdin), encoding: 'utf8' })
assert.equal(runHook('posttool', { cwd: project }).stdout, '', 'normal messages are not injected mid-turn')
const stop = JSON.parse(runHook('stop', { hook_event_name: 'Stop', stop_hook_active: false, cwd: project }).stdout)
assert.equal(stop.decision, 'block', 'Stop continues the turn to relay the message')
assert.match(stop.reason, /\[room: bug-hunt\] alice \(harness: claude-code\): check session\.ts/)
assert.match(stop.reason, /untrusted data/)
assert.equal(fs.readdirSync(inbox).length, 0, 'delivered once')
assert.equal(runHook('stop', { stop_hook_active: false, cwd: project }).stdout, '', 'nothing left to deliver')
put('2.json', { text: 'stop, merging now', priority: 'interrupt' })
assert.equal(runHook('stop', { stop_hook_active: true, cwd: project }).stdout, '', 'never loops on a continued stop')
const mid = JSON.parse(runHook('posttool', { cwd: project }).stdout)
assert.equal(mid.hookSpecificOutput.hookEventName, 'PostToolUse')
assert.match(mid.hookSpecificOutput.additionalContext, /stop, merging now/, 'interrupt lands mid-turn')

const codex = spawnSync(process.env.CODEX_BIN || 'codex', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
if (codex.status !== 0) {
  console.log('4–6. SKIPPED: no `codex` CLI on PATH, so Codex trust could not be checked.')
} else {
  // A repo's committed config can carry a hook that merely looks like ours.
  fs.mkdirSync(path.join(project, '.codex'))
  fs.writeFileSync(path.join(project, '.codex', 'config.toml'),
    '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\n' +
    `command = ${JSON.stringify(codexHookCommand('stop') + ' # pwned')}\n`)
  fs.writeFileSync(path.join(codexHome, 'config.toml'), `[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`)

  console.log(`4. Codex itself confirms the server and all three hooks (${codex.stdout.trim()})…`)
  const r = await installCodex({ cwd: project })
  assert.deepEqual([...r.events].sort(), ['postToolUse', 'stop', 'userPromptSubmit'], JSON.stringify(r))
  assert.equal(r.trustedNow, 3)
  assert.ok(r.mcpSeen, 'Codex reads the MCP server from the user config')
  const userToml = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8')
  assert.match(userToml, /\[mcp_servers\.session-multiplayer\]/)
  assert.ok(userToml.includes(JSON.stringify(SERVER)), 'server path written')
  assert.match(userToml, /SESSION_MULTIPLAYER_HARNESS = "codex"/)
  assert.ok(!userToml.includes('someone-elses-hook'), 'a foreign hook is not trusted on its owner\'s behalf')

  console.log('5. A look-alike of our hook elsewhere is never trusted…')
  const listed = await withAppServer(call => call('hooks/list', { cwds: [project] }))
  const lookAlike = listed.data[0].hooks.find(x => x.command.includes('pwned'))
  assert.ok(lookAlike, 'Codex sees the look-alike hook')
  assert.notEqual(lookAlike.trustStatus, 'trusted')
  const foreign = listed.data[0].hooks.find(x => x.command.includes('someone-elses-hook'))
  assert.notEqual(foreign.trustStatus, 'trusted')

  console.log('6. Registering again trusts nothing new, and replaces a stale server entry…')
  const cfg = path.join(codexHome, 'config.toml')
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('[mcp_servers.session-multiplayer]\n', '[mcp_servers.session-multiplayer]\ncwd = "/stale"\n'))
  assert.match(fs.readFileSync(cfg, 'utf8'), /\/stale/)
  const again = await installCodex({ cwd: project })
  assert.equal(again.trustedNow, 0)
  assert.equal(again.events.length, 3)
  const after = fs.readFileSync(cfg, 'utf8')
  assert.equal(after.match(/\[mcp_servers\.session-multiplayer\]/g).length, 1)
  assert.ok(!after.includes('/stale'), 'stale server fields replaced, not merged')
}

console.log('7. A missing codex CLI fails fast instead of waiting out the timeout…')
const t0 = Date.now()
await assert.rejects(withAppServer(async () => {}, { bin: path.join(fakeHome, 'no-such-codex') }))
assert.ok(Date.now() - t0 < 5000, 'rejected quickly')
// A server that exits at once (stand-in: `false`) is a rejected call, never an uncaught EPIPE.
if (process.platform !== 'win32') {
  for (let i = 0; i < 20; i++) await assert.rejects(withAppServer(async () => {}, { bin: 'false' }))
}

fs.rmSync(fakeHome, { recursive: true, force: true })
fs.rmSync(project, { recursive: true, force: true })
console.log('\nAll Codex tests passed.')
