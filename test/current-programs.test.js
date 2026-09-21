import test from 'node:test'
import assert from 'node:assert/strict'
import { currentPrograms } from '../parity/current-programs.mjs'

test('current discovery excludes only retired effects absent from the manifest', () => {
  const names = ['bc', 'hs', 'colorspace', 'adjust', 'unknown', 'hs_variant']
  assert.deepEqual(currentPrograms(names, { 'filter/adjust': {} }, () => {}), ['adjust', 'unknown', 'hs_variant'])
})

test('historical engines retain their supported fixtures', () => {
  const names = ['bc', 'hs', 'colorspace', 'adjust']
  const manifest = Object.fromEntries(names.map(name => [`filter/${name}`, {}]))
  assert.deepEqual(currentPrograms(names, manifest, () => {}), names)
})

test('retirement is reported without producing passing or skipped coverage', () => {
  const messages = []
  assert.deepEqual(currentPrograms(['bc', 'adjust'], {}, message => messages.push(message)), ['adjust'])
  assert.deepEqual(messages, ['[RETIRED] bc: filter/bc is absent from the current engine'])
})
