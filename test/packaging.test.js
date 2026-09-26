import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// GAP-001 regression guard: every advertised package entry point — plus its whole
// relative-import closure (the compiler tool, the vendored-engine loader, the vendor fetch
// script) — must be in the packed tarball. The closure is DERIVED from the actual import
// statements, so a future excluded dependency cannot pass this guard silently.
// `npm pack --dry-run` exercises the real `files` allowlist without writing a tarball.

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// Statically walk the relative-import graph of the package from its advertised entry points.
function importClosure () {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const seen = new Set()
  const queue = Object.values(pkg.exports).map(spec => resolve(ROOT, spec))
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/(?:import|export)[^'";]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] || m[2]
      if (!spec || !spec.startsWith('.')) continue
      queue.push(resolve(dirname(file), spec))
    }
  }
  return [...seen].map(file => relative(ROOT, file))
}

test('packed distribution contains every advertised entry point and its derived import closure', () => {
  const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  }))
  const packed = new Set(out[0].files.map(f => f.path))
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

  for (const entry of Object.values(pkg.exports)) {
    assert.ok(packed.has(entry.replace(/^\.\//, '')), `advertised entry ${entry} missing from packed distribution`)
  }
  for (const required of importClosure()) {
    assert.ok(packed.has(required), `packed distribution must include imported file: ${required}`)
  }
})
