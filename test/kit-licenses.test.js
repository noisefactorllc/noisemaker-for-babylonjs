import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// GAP-002 regression guard: the export kit bundles @babylonjs/core (Apache-2.0), so its
// distribution must carry Babylon's license text and NOTICE file. The kit system only
// ships what kit.config.json's `licenses` list names, so that list must include the
// license.md and NOTICE.md from the exact dependency distribution (node_modules), and
// those package files must exist in the installed 9.13.x that gets bundled.

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const BABYLON_DIR = join(ROOT, 'node_modules', '@babylonjs', 'core')
// Babylon 9.x ships its license as `license.md` inside the package.
const REQUIRED = [
  { from: 'node_modules/@babylonjs/core/license.md', to: 'LICENSES/babylonjs-core-license.txt' },
  { from: 'node_modules/@babylonjs/core/NOTICE.md', to: 'LICENSES/babylonjs-core-NOTICE.txt' }
]

test('kit licenses list ships Babylon license and NOTICE with the bundled engine version', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'export-kit', 'kit.config.json'), 'utf8'))
  const hostLib = config.hostLib
  assert.ok(hostLib, 'kit.config.json must declare the bundled host library')
  assert.equal(hostLib.package, '@babylonjs/core')

  for (const required of REQUIRED) {
    const entry = config.licenses.find(l => l.to === required.to)
    assert.ok(entry, `kit.config.json licenses must ship ${required.to}`)
    assert.equal(entry.from, required.from)
    // The source file must exist in the installed dependency distribution the kit bundles.
    assert.ok(readFileSync(join(ROOT, entry.from)).length > 0, `${entry.from} must be a real file`)
  }
})

test('installed Babylon distribution is the parity-pinned Apache-2.0 9.13.x with license files', () => {
  const pkg = JSON.parse(readFileSync(join(BABYLON_DIR, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@babylonjs/core')
  assert.equal(pkg.license, 'Apache-2.0')
  assert.ok(
    pkg.version.startsWith('9.13.'),
    `expected the parity-pinned 9.13.x, installed ${pkg.version}`
  )
  assert.equal(pkg.dependencies, undefined, 'Babylon core has no transitive dependencies to attribute')
})
