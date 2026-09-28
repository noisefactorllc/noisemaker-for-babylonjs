import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve a Playwright chromium install for the headless engine tests.
//
// Playwright resolves its browser registry from PLAYWRIGHT_BROWSERS_PATH or the
// default ~/.cache/ms-playwright. In the Worker Elves containers HOME sits on a
// noexec tmpfs, so a browser downloaded to the default path cannot be executed
// (launch fails with EACCES / "Executable doesn't exist"), and prepared
// environments keep the browsers on an exec-mounted cache instead. When the
// caller left PLAYWRIGHT_BROWSERS_PATH unset AND the default registry holds no
// chromium install, point it at the first known exec-mounted cache that has
// one. An explicit PLAYWRIGHT_BROWSERS_PATH or a populated default registry is
// always left untouched — this only repairs the bare `npm test` case.
//
// The resolution runs at MODULE-EVALUATION time (and this module must be
// imported before 'playwright'): the Playwright registry reads
// PLAYWRIGHT_BROWSERS_PATH when the module is first imported, so an env var
// set later in the same process is ignored.
const FALLBACK_BROWSER_ROOTS = [
  join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'ms-playwright'),
  '/state/cache/pw-browsers'
]

const hasChromium = (root) => {
  try {
    return readdirSync(root).some(d => d.startsWith('chromium'))
  } catch {
    return false
  }
}

if (!process.env.PLAYWRIGHT_BROWSERS_PATH &&
    !hasChromium(join(homedir(), '.cache', 'ms-playwright'))) {
  for (const root of FALLBACK_BROWSER_ROOTS) {
    if (existsSync(root) && hasChromium(root)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = root
      break
    }
  }
}

export const ensurePlaywrightBrowsersPath = () => {}
