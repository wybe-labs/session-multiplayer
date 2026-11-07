// Registers this MCP server with OpenAI Codex CLI: `npm run register:codex`
//
// User-wide, like the Claude Code adapter: the MCP server in ~/.codex/config.toml
// and the delivery hooks in ~/.codex/hooks.json, trusted through Codex itself (see
// install.js). Messages then reach a running Codex session the same way they reach
// Claude Code: "interrupt" mid-turn, "normal" at turn end, "passive" in the inbox.
import { installCodex, mcpServerConfig, HOOK_MODES, codexHookCommand, codexHooksPath } from './install.js'

try {
  const r = await installCodex()
  for (const w of r.warnings) console.log(`NOTE (from Codex): ${typeof w === 'string' ? w : JSON.stringify(w)}`)
  for (const e of r.errors) console.error(`WARNING (from Codex): ${typeof e === 'string' ? e : JSON.stringify(e)}`)
  if (!r.mcpSeen) throw new Error('Codex does not show the session-multiplayer MCP server after writing it')
  if (r.events.length !== HOOK_MODES.length) {
    throw new Error(`Codex runs only ${r.events.length} of ${HOOK_MODES.length} delivery hooks (${r.events.join(', ') || 'none'}); check ${r.hooksFile} and Codex's /hooks screen`)
  }
  console.log(`Registered with Codex: MCP server in ${process.env.CODEX_HOME || '~/.codex'}/config.toml, delivery hooks in ${r.hooksFile}` +
    (r.trustedNow ? ` (${r.trustedNow} newly trusted)` : ' (already trusted)') + '.')
  console.log('Restart your Codex session; /mcp should list session-multiplayer.')
} catch (err) {
  console.error(`\nCould not register with Codex automatically: ${err.message}\n`)
  console.error('Add this to ~/.codex/config.toml (or $CODEX_HOME/config.toml) instead:\n')
  const c = mcpServerConfig()
  console.error('[mcp_servers.session-multiplayer]')
  console.error(`command = ${JSON.stringify(c.command)}`)
  console.error(`args = ${JSON.stringify(c.args)}`)
  console.error(`env_vars = ${JSON.stringify(c.env_vars)}`)
  console.error(`startup_timeout_sec = ${c.startup_timeout_sec}`)
  console.error('')
  console.error('[mcp_servers.session-multiplayer.env]')
  console.error('SESSION_MULTIPLAYER_HARNESS = "codex"')
  console.error(`\nFor live delivery, add these command hooks to ${codexHooksPath()} (PostToolUse with matcher ".*", Stop, UserPromptSubmit) and trust them in Codex's /hooks screen:`)
  for (const m of HOOK_MODES) console.error(`  ${codexHookCommand(m)}`)
  console.error('\nWithout the hooks, messages wait in the inbox: add to AGENTS.md "If the session-multiplayer MCP server is available, call its check_messages tool when you start working and after finishing a task."')
  process.exitCode = 1
}
