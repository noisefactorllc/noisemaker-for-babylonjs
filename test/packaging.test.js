import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

// GAP-001 regression guard: the packed distribution must ship every advertised entry point
// plus its import closure (the compiler tool and the vendored-engine loader + fetch script).
// `npm pack --dry-run` exercises the real `files` allowlist without writing a tarball.

test('packed distribution contains every advertised entry point and its import closure', () => {
  const pkg = createRequire(import.meta.url)('../package.json')
  const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  }))
  const contents = out[0].files.map(f => f.path)

  for (const entry of Object.values(pkg.exports)) {
    const rel = entry.replace(/^\.\//, '')
    assert.ok(contents.includes(rel), `advertised entry ${entry} missing from packed distribution`)
  }
  for (const required of ['tools/export-fat-graph.mjs', 'vendor/engine.mjs', 'vendor/fetch.sh']) {
    assert.ok(contents.includes(required), `compiler dependency ${required} missing from packed distribution`)
  }
})
