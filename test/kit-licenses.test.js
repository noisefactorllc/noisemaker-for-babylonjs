import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// GAP-002 regression guard: the export kit bundles @babylonjs/core (Apache-2.0), so its
// distribution must carry Babylon's license text and NOTICE file. The kit system only
// ships what kit.config.json's `licenses` list names, so the committed copies under
// export-kit/licenses/ must be byte-identical to the exact dependency distribution
// (node_modules) and each must be referenced by a licenses entry.

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const BABYLON_DIR = join(ROOT, 'node_modules', '@babylonjs', 'core')
// Babylon 9.x ships its license as `license.md` and its attribution notices as
// `NOTICE.md` inside the package; the kit ships both byte-identically.
const REQUIRED = [
  {
    dependency: join(BABYLON_DIR, 'license.md'),
    committed: join(ROOT, 'export-kit', 'licenses', 'babylonjs-core-license.txt'),
    to: 'LICENSES/babylonjs-core-license.txt'
  },
  {
    dependency: join(BABYLON_DIR, 'NOTICE.md'),
    committed: join(ROOT, 'export-kit', 'licenses', 'babylonjs-core-NOTICE.txt'),
    to: 'LICENSES/babylonjs-core-NOTICE.txt'
  }
]

test('kit licenses list ships Babylon license and NOTICE with the bundled engine version', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'export-kit', 'kit.config.json'), 'utf8'))
  const hostLib = config.hostLib
  assert.ok(hostLib, 'kit.config.json must declare the bundled host library')
  assert.equal(hostLib.package, '@babylonjs/core')

  for (const { committed, to } of REQUIRED) {
    const entry = config.licenses.find(l => l.to === to)
    assert.ok(entry, `kit.config.json licenses must ship ${to}`)
    // The `from` side must be the committed byte-identical copy of the dependency file.
    assert.equal(entry.from, committed.slice(ROOT.length).replaceAll('\\', '/'))
    assert.ok(readFileSync(committed).length > 0, `${entry.from} must be a real file`)
  }
})

test('committed Babylon license files are byte-identical to the installed 9.13.0 distribution', () => {
  const pkg = JSON.parse(readFileSync(join(BABYLON_DIR, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@babylonjs/core')
  assert.equal(pkg.license, 'Apache-2.0')
  assert.ok(
    pkg.version.startsWith('9.13.'),
    `expected the parity-pinned 9.13.x, installed ${pkg.version}`
  )
  assert.equal(pkg.dependencies, undefined, 'Babylon core has no transitive dependencies to attribute')
  for (const { dependency, committed } of REQUIRED) {
    const depBytes = readFileSync(dependency)
    const depHash = createHash('sha256').update(depBytes).digest('hex')
    const committedBytes = readFileSync(committed)
    const committedHash = createHash('sha256').update(committedBytes).digest('hex')
    assert.equal(
      committedHash, depHash,
      `committed ${committed} (${committedHash}) must match the installed package's ${dependency} (${depHash})`
    )
  }
})
