import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

// Per-project scoping. Room membership is a property of the project directory a
// session runs in, not of the machine: each project gets its own store under
// ~/.session-multiplayer/projects/<key>, so joining a room in one project never
// makes sessions in other projects members. The MCP server and any delivery
// hooks are launched in the project directory (Claude Code hooks additionally
// get CLAUDE_PROJECT_DIR), so both sides derive the same key with no
// coordination.
//
// SESSION_MULTIPLAYER_DIR overrides scoping entirely: it names one exact store
// directory (the escape hatch for tests or deliberately shared state).
// CLAUDE_TOGETHER_DIR is honored as a legacy alias so a store created by
// claude-together — which speaks the same protocol and store format — can be
// reused as-is.

export function root () {
  return path.join(os.homedir(), '.session-multiplayer')
}

export function projectDir () {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd())
}

// Readable + collision-safe directory name: project basename, plus a hash of the
// full path (case-folded on case-insensitive filesystems) to disambiguate
// same-named folders in different places.
export function projectKey (dir = projectDir()) {
  const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin'
  const norm = caseInsensitive ? dir.toLowerCase() : dir
  const digest = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12)
  const base = (path.basename(dir) || 'root').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40)
  return `${base}-${digest}`
}

export function overrideDir () {
  return process.env.SESSION_MULTIPLAYER_DIR || process.env.CLAUDE_TOGETHER_DIR || null
}

export function scopedDir () {
  return overrideDir() || path.join(root(), 'projects', projectKey())
}

// Display name stays machine-global — you are the same person in every project.
export function identityFile () {
  return path.join(root(), 'config.json')
}
