// Registers this MCP server with OpenCode: `npm run register:opencode`
//
// OpenCode reads MCP servers from opencode.json: project-level (repo root) or
// the global config at ~/.config/opencode/opencode.json. This merges the server
// into the global config when it exists (or creates it), and always prints the
// project-level snippet for people who prefer per-repo configuration.
//
// Like Codex, OpenCode has no injection hooks: messages land in the inbox and
// the agent reads them with the check_messages tool.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const server = path.join(root, 'src', 'server.js')

const entry = {
  type: 'local',
  command: [process.execPath, server],
  enabled: true,
  environment: { SESSION_MULTIPLAYER_HARNESS: 'opencode' }
}

const globalConfig = path.join(os.homedir(), '.config', 'opencode', 'opencode.json')
try {
  fs.mkdirSync(path.dirname(globalConfig), { recursive: true })
  let config = {}
  if (fs.existsSync(globalConfig)) {
    config = JSON.parse(fs.readFileSync(globalConfig, 'utf8'))
  }
  config.mcp = config.mcp || {}
  config.mcp['session-multiplayer'] = entry
  fs.writeFileSync(globalConfig, JSON.stringify(config, null, 2))
  console.log(`Registered in ${globalConfig}. Restart OpenCode to pick it up.`)
} catch (err) {
  console.error(`Could not update ${globalConfig}: ${err.message}`)
  process.exitCode = 1
}

console.log('\nPer-repo alternative: add this to opencode.json in the repository root:\n')
console.log(JSON.stringify({ mcp: { 'session-multiplayer': entry } }, null, 2))
console.log('\nRecommended: add this line to your project or global AGENTS.md so OpenCode checks its mail:')
console.log('  "If the session-multiplayer MCP server is available, call its check_messages tool when you start working and after finishing a task."')
