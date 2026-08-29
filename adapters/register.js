// Dispatcher: `npm run register` — tells you which harness-specific registration
// to run. Each adapter registers the SAME server; rooms mix harnesses freely.
console.log('session-multiplayer registers per harness. Pick yours:')
console.log('')
console.log('  npm run register:claude   Claude Code (MCP server + delivery hooks + /sm-* commands)')
console.log('  npm run register:codex    OpenAI Codex CLI (MCP server via ~/.codex/config.toml)')
console.log('')
console.log('Any other MCP harness: register a stdio server that runs')
console.log('  node ' + new URL('../src/server.js', import.meta.url).pathname)
console.log('and set env SESSION_MULTIPLAYER_HARNESS=<harness-name> so peers can see where you run.')
