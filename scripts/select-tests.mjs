import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Select the test files that reference the supervisor's changed paths.
//
// NM_CHANGED_FILES lists one repository-relative path per line. A test file
// exercises a changed path when its source names the path's base name, so the
// focused gate runs exactly the tests that can observe the change. A changed
// path that maps to no test file is a hard error: focused coverage must never
// shrink silently. With NM_CHANGED_FILES unset the caller runs the whole suite
// unchanged; this selector is never consulted.
const changed = (process.env.NM_CHANGED_FILES || '')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean)

if (changed.length === 0) {
  console.error('select-tests: NM_CHANGED_FILES is set but empty')
  process.exit(2)
}

// A changed test file exercises itself: it always joins the selection.
// Other test-infrastructure paths (the entrypoint, the selector, support
// modules under test/) have no test that exercises them by name: they ARE the
// runner. They contribute no selection; a stderr note records the exclusion.
// Product paths that no test file references remain a hard error, so focused
// coverage never shrinks silently for the code the suite exists to check. When
// nothing selects at all (an infrastructure-only change), the whole suite runs.
const infra = changed.filter(p => p.startsWith('test/') || p.startsWith('scripts/'))
if (infra.length > 0) {
  console.error(`select-tests: test-infrastructure paths select no tests by name: ${infra.join(', ')}`)
}

const tests = readdirSync('test').filter(f => f.endsWith('.test.js')).sort()
const bodies = new Map(tests.map(f => [f, readFileSync(join('test', f), 'utf8')]))

const selected = new Set(changed.filter(p => tests.includes(p.split('/').pop())))

const tokensFor = (path) => {
  const base = path.split('/').pop()
  const tokens = new Set([base])
  const dot = base.lastIndexOf('.')
  if (dot > 0) tokens.add(base.slice(0, dot))
  return [...tokens]
}

const matchesToken = (body, token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(body)

const unmapped = []
for (const path of changed) {
  if (infra.includes(path)) continue
  const tokens = tokensFor(path)
  let hit = false
  for (const f of tests) {
    if (matchesToken(bodies.get(f), path) || tokens.some(t => matchesToken(bodies.get(f), t))) {
      selected.add(`test/${f}`)
      hit = true
    }
  }
  if (!hit) unmapped.push(path)
}

if (unmapped.length > 0) {
  console.error(`select-tests: no test file references: ${unmapped.join(', ')}`)
  process.exit(2)
}
if (selected.size === 0) {
  process.stdout.write(tests.map(f => `test/${f}`).join(' '))
} else {
  process.stdout.write([...selected].join(' '))
}
