import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Only these historical fixtures may be retired by a current engine refresh.
const retiredEffects = new Set(['bc', 'hs', 'colorspace'])

export function currentPrograms(names, manifest = JSON.parse(readFileSync(new URL('../vendor/noisemaker/effects/manifest.json', import.meta.url), 'utf8')), report = console.error) {
  return names.filter(name => {
    if (!retiredEffects.has(name) || Object.hasOwn(manifest, `filter/${name}`)) return true
    report(`[RETIRED] ${name}: filter/${name} is absent from the current engine`)
    return false
  })
}

// The shell sweep requests the same roster as direct batch discovery.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = readdirSync(new URL('./programs/', import.meta.url))
    .filter(name => name.endsWith('.dsl') && !name.startsWith('corpus_'))
    .map(name => name.slice(0, -4)).sort()
  console.log(currentPrograms(names).join('\n'))
}
