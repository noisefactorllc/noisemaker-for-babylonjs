import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { bundleInputsAreFresh } from '../parity/render-candidate.mjs'

test('browser harness bundle freshness includes every watched source timestamp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nm-bundle-freshness-'))
  const bundle = join(dir, 'bundle.js')
  const backend = join(dir, 'backend.js')
  const renderer = join(dir, 'renderer.js')

  try {
    for (const path of [bundle, backend, renderer]) writeFileSync(path, '')
    utimesSync(backend, 1, 1)
    utimesSync(renderer, 2, 2)
    utimesSync(bundle, 3, 3)
    assert.equal(bundleInputsAreFresh(bundle, [backend, renderer]), true)

    utimesSync(renderer, 4, 4)
    assert.equal(bundleInputsAreFresh(bundle, [backend, renderer]), false)
    assert.equal(bundleInputsAreFresh(bundle, [backend, join(dir, 'missing.js')]), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
