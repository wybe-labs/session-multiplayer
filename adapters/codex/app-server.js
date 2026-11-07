// Talks to Codex's own app-server (`codex app-server`, JSON-RPC over stdio, one
// message per line). Codex runs a hook only once its exact definition is trusted by
// hash, and those hashes are Codex's to compute: rather than re-deriving them,
// register asks Codex (`hooks/list` reports each hook's key and current hash) and
// records trust with `config/batchWrite`, the same way Codex's own /hooks screen
// does. The same writer edits ~/.codex/config.toml, so no TOML library is needed.
import { spawn } from 'node:child_process'
import readline from 'node:readline'

export async function withAppServer (fn, { bin = process.env.CODEX_BIN || 'codex', timeoutMs = 30000 } = {}) {
  const isWin = process.platform === 'win32'
  // On Windows the CLI is a .cmd that only a shell resolves; quote it for paths with spaces.
  const child = spawn(isWin ? `"${bin}"` : bin, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], shell: isWin, windowsHide: true })
  let stderr = ''
  child.stderr.on('data', d => { stderr = (stderr + d).slice(-4000) })
  const pending = new Map()
  let nextId = 0
  let exited = null
  const failAll = err => { for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(err) } pending.clear() }
  child.on('error', err => { exited = err; failAll(err) })
  child.on('exit', code => {
    exited = exited || new Error(`codex app-server exited (${code})${stderr ? `: ${stderr.trim()}` : ''}`)
    failAll(exited)
  })
  readline.createInterface({ input: child.stdout }).on('line', line => {
    let msg
    try { msg = JSON.parse(line) } catch { return }
    if (msg.id == null || !pending.has(msg.id)) return
    const { resolve, reject, timer } = pending.get(msg.id)
    pending.delete(msg.id)
    clearTimeout(timer)
    if (msg.error) reject(new Error(`${msg.error.message || 'app-server error'} (${JSON.stringify(msg.error.data ?? msg.error.code)})`))
    else resolve(msg.result)
  })
  const call = (method, params) => new Promise((resolve, reject) => {
    if (exited) return reject(exited)
    const id = ++nextId
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`codex app-server did not answer ${method} within ${timeoutMs / 1000}s`))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n')
  })
  try {
    await call('initialize', { clientInfo: { name: 'session-multiplayer', version: '1' } })
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    return await fn(call)
  } finally {
    child.stdin.end()
    child.kill()
  }
}
