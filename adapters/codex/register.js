// Registers this MCP server with OpenAI Codex CLI: `npm run register:codex`
//
// Tries `codex mcp add` first (ships with Codex CLI since early 2026; persists
// to ~/.codex/config.toml). If the CLI isn't available, prints the exact TOML
// to paste into ~/.codex/config.toml (or $CODEX_HOME/config.toml) instead.
//
// Codex has no hook system, so there is no mid-turn injection: messages land in
// the inbox and the agent reads them with the check_messages tool. The tool
// descriptions already tell the model to poll; the AGENTS.md line printed below
// makes that even more reliable.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const server = path.join(root, 'src', 'server.js')

const args = ['mcp', 'add', 'session-multiplayer',
  '--env', 'SESSION_MULTIPLAYER_HARNESS=codex',
  '--', process.execPath, server]

const isWin = process.platform === 'win32'
const res = spawnSync(isWin ? 'codex.cmd' : 'codex', args, { stdio: 'inherit', shell: isWin })

if (res.error || res.status !== 0) {
  console.error('\nCould not run the `codex` CLI automatically. Add this to ~/.codex/config.toml instead:\n')
  console.error('[mcp_servers.session-multiplayer]')
  console.error(`command = ${JSON.stringify(process.execPath)}`)
  console.error(`args = [${JSON.stringify(server)}]`)
  console.error('')
  console.error('[mcp_servers.session-multiplayer.env]')
  console.error('SESSION_MULTIPLAYER_HARNESS = "codex"')
  process.exitCode = 1
} else {
  console.log('\nRegistered with Codex. Start a Codex session and run /mcp to verify the connection.')
}

console.log('\nRecommended: add this line to your project or global AGENTS.md so Codex checks its mail:')
console.log('  "If the session-multiplayer MCP server is available, call its check_messages tool when you start working and after finishing a task — teammates\' sessions may have sent messages."')
