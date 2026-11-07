// Codex registration, user-wide like the Claude Code adapter:
//
//   ~/.codex/config.toml  [mcp_servers.session-multiplayer]
//   ~/.codex/hooks.json   the Claude Code delivery hook, for PostToolUse / Stop / UserPromptSubmit
//   ~/.codex/config.toml  those three hooks' hashes marked trusted
//
// Codex's hook protocol is Claude-compatible (additionalContext, decision:"block",
// stop_hook_active), so the same hook.js delivers on both. Codex skips a hook until
// its exact definition is trusted, without saying so in the session; register has
// Codex itself record that trust, and only for the exact commands it wrote.
// ($CODEX_HOME replaces ~/.codex when set.)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withAppServer } from './app-server.js'
import { isOurs } from '../claude-code/install-hooks.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const HOOK_SCRIPT = path.join(ROOT, 'adapters', 'claude-code', 'hook.js')
export const SERVER = path.join(ROOT, 'src', 'server.js')
export const MCP_NAME = 'session-multiplayer'
export const HOOK_MODES = ['posttool', 'stop', 'prompt']

// Codex starts MCP servers with a minimal environment. Forward the overrides that
// decide which store the server uses, so it agrees with the hooks (which inherit
// the session's environment) about where the inbox is.
const FORWARDED_ENV = ['SESSION_MULTIPLAYER_DIR', 'SESSION_MULTIPLAYER_LABEL', 'CLAUDE_TOGETHER_DIR', 'CLAUDE_TOGETHER_LABEL']

export function codexHome () {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
}

export function codexHooksPath () {
  return path.join(codexHome(), 'hooks.json')
}

// The exact command register writes, and the only thing it will ever trust.
// Codex runs the command through a shell, and double quotes do not stop $(…),
// backticks or %VAR% expansion, so paths carrying those characters are refused
// rather than trusted. (Backslash is a path separator only on Windows.)
const UNSAFE = process.platform === 'win32' ? /["$`%!]/ : /["$`%!\\]/
export function codexHookCommand (mode, { node = process.execPath, hookScript = HOOK_SCRIPT } = {}) {
  const bad = [node, hookScript].find(v => UNSAFE.test(v))
  if (bad) throw new Error(`cannot write a safe hook command for ${bad}: move it to a path without " $ ` + '`' + ` % ! or \\`)
  return `"${node}" "${hookScript}" ${mode} codex`
}

// A Codex hook entry this adapter wrote (any node or checkout path), and nothing else.
const isOurCodexHook = command => isOurs(command) && /hook\.js"?\s+(posttool|stop|prompt)\s+codex\s*$/.test(String(command))

export function mcpServerConfig ({ node = process.execPath, server = SERVER } = {}) {
  return {
    command: node,
    args: [server],
    env: { SESSION_MULTIPLAYER_HARNESS: 'codex' },
    env_vars: FORWARDED_ENV,
    // Joining the DHT can take a few seconds on a cold start.
    startup_timeout_sec: 30
  }
}

export function installCodexHooks (opts = {}) {
  const file = codexHooksPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  let settings = {}
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
    } catch (err) {
      throw new Error(`${file} exists but is not valid JSON — fix it first (${err.message})`)
    }
  }
  const cmd = mode => codexHookCommand(mode, opts)
  const wanted = {
    // Codex matchers are regular expressions; "*" alone is not one.
    PostToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: cmd('posttool') }] }],
    Stop: [{ hooks: [{ type: 'command', command: cmd('stop') }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd('prompt') }] }]
  }
  settings.hooks = settings.hooks || {}
  for (const [event, entries] of Object.entries(wanted)) {
    const existing = settings.hooks[event] ?? []
    if (!Array.isArray(existing)) throw new Error(`${file}: hooks.${event} is not a list — fix it by hand first rather than have it overwritten`)
    // Remove only our own hooks; a group that also holds someone else's hook keeps it.
    const others = existing.flatMap(e => {
      if (!Array.isArray(e?.hooks)) return [e]
      const kept = e.hooks.filter(h => !isOurCodexHook(h?.command))
      if (kept.length === e.hooks.length) return [e]
      return kept.length ? [{ ...e, hooks: kept }] : []
    })
    settings.hooks[event] = [...others, ...entries]
  }
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2))
  fs.renameSync(tmp, file)
  return file
}

const real = p => { try { return fs.realpathSync(p) } catch { return path.resolve(p) } }

// Our hooks as Codex lists them. Only what register itself wrote counts: the exact
// command, from the exact hooks.json. A look-alike anywhere else — a project's
// committed .codex/ setup, say — is never trusted on our say-so.
export async function listOurCodexHooks (call, { cwd = os.homedir(), hooksFile = codexHooksPath(), commands } = {}) {
  const res = await call('hooks/list', { cwds: [cwd] })
  const entry = (res?.data || [])[0] || { hooks: [], warnings: [], errors: [] }
  const exact = new Set(commands)
  const ours = (entry.hooks || []).filter(h => h.handlerType === 'command' &&
    exact.has(h.command) && h.sourcePath && real(h.sourcePath) === real(hooksFile))
  return { ours, warnings: entry.warnings || [], errors: entry.errors || [] }
}

// Writes everything, then has Codex confirm it sees the server and runs our three hooks.
export async function installCodex (opts = {}) {
  const hooksFile = installCodexHooks(opts)
  const commands = HOOK_MODES.map(m => codexHookCommand(m, opts))
  const list = call => listOurCodexHooks(call, { hooksFile, commands, cwd: opts.cwd })
  return withAppServer(async call => {
    await call('config/batchWrite', {
      edits: [{ keyPath: `mcp_servers.${MCP_NAME}`, value: mcpServerConfig(opts), mergeStrategy: 'replace' }],
      reloadUserConfig: true
    })
    const before = await list(call)
    const toTrust = before.ours.filter(h => h.trustStatus === 'untrusted' || h.trustStatus === 'modified')
    if (toTrust.length) {
      await call('config/batchWrite', {
        edits: [{
          keyPath: 'hooks.state',
          value: Object.fromEntries(toTrust.map(h => [h.key, { trusted_hash: h.currentHash }])),
          mergeStrategy: 'upsert'
        }],
        reloadUserConfig: true
      })
    }
    const after = await list(call)
    const effective = await call('config/read', { cwd: opts.cwd || os.homedir() })
    return {
      hooksFile,
      mcpSeen: Boolean(effective?.config?.mcp_servers?.[MCP_NAME]),
      trustedNow: toTrust.length,
      events: [...new Set(after.ours.filter(h => h.trustStatus === 'trusted' && h.enabled).map(h => h.eventName))],
      warnings: [...before.warnings, ...after.warnings],
      errors: [...before.errors, ...after.errors]
    }
  }, opts)
}
